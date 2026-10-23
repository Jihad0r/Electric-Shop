import Order from "@/models/Order";
import Payment from "@/models/Payment";
import Shipment from "@/models/Shipment";

// The shipment follows the order's status
const SHIPMENT_STATUS = {
  pending: "pending",
  confirmed: "pending",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

const idOf = (value) => value?._id ?? value;

async function run(order) {
  const now = new Date();
  const userId = idOf(order.user);

  /* Payment */
  let payment = await Payment.findOne({ order: order._id });
  if (!payment) {
    payment = new Payment({
      order: order._id,
      user: userId,
      method: order.paymentMethod,
      provider: order.paymentMethod === "cod" ? "cash" : "stripe",
      amount: order.totalPrice,
    });
  }
  payment.amount = order.totalPrice;
  payment.currency = order.currency;
  payment.status = order.paymentStatus;
  if (order.paymentStatus === "paid") payment.paidAt = order.paidAt || payment.paidAt || now;
  if (order.paymentStatus === "refunded") payment.refundedAt = payment.refundedAt || now;
    payment.providerIntentionId = order.stripe?.sessionId || order.paymob?.intentionId || "";
  payment.providerOrderId = order.paymob?.orderId || "";
  payment.transactionId = order.stripe?.paymentIntentId || order.paymob?.transactionId || "";
  await payment.save();

  /* Shipment */
  let shipment = await Shipment.findOne({ order: order._id });
  if (!shipment) {
    const a = order.shippingAddress || {};
    shipment = new Shipment({
      order: order._id,
      user: userId,
      address: {
        fullName: a.fullName,
        phone: a.phone,
        street: a.street,
        city: a.city,
        postalCode: a.postalCode,
        country: a.country,
      },
    });
  }

  const status = SHIPMENT_STATUS[order.status] ?? "pending";
    // A parcel Bosta reported as returned stays "returned" while the order is still marked shipped
  if (!(shipment.status === "returned" && status === "shipped")) shipment.status = status;
  shipment.collectOnDelivery = order.paymentMethod === "cod" ? order.totalPrice : 0;

  if ((status === "shipped" || status === "delivered") && !shipment.shippedAt) {
    shipment.shippedAt = now;
  }
  if (status === "delivered") {
    shipment.deliveredAt = shipment.deliveredAt || now;
    // Cash on delivery: the money is collected at the moment of delivery
    if (shipment.collectOnDelivery > 0) {
      shipment.cashCollectedAt = shipment.cashCollectedAt || shipment.deliveredAt;
    }
  }
  await shipment.save();

  /* Link them back to the order */
  if (
    String(order.payment ?? "") !== String(payment._id) ||
    String(order.shipment ?? "") !== String(shipment._id)
  ) {
    await Order.updateOne(
      { _id: order._id },
      { $set: { payment: payment._id, shipment: shipment._id } }
    );
  }
}

// Makes the Payment and Shipment records match the order. Safe to call any number of times.
// It never throws: if it fails, the order itself is unaffected (see the repair route).
export async function syncRecords(order) {
  try {
    try {
      await run(order);
    } catch (error) {
      // Two requests created the record at the same moment: the second one just retries
      if (error?.code !== 11000) throw error;
      await run(order);
    }
    return true;
  } catch (error) {
    console.error("Could not sync payment and shipment records:", error);
    return false;
  }
}

// Courier and tracking number, entered by the admin
export async function setShipmentDetails(orderId, { trackingNumber, courier } = {}) {
  const set = {};
  if (typeof trackingNumber === "string") set.trackingNumber = trackingNumber.trim().slice(0, 60);
  if (typeof courier === "string") set.courier = courier.trim().slice(0, 60);
  if (Object.keys(set).length === 0) return;

  await Shipment.updateOne({ order: orderId }, { $set: set });
}