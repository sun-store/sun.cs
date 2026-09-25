import type { CustomerOrder } from '../../shared/domain'

export async function loadCustomerOrders(input: {
  sunstoreUserId?: string | null
  relatedTransactionId?: string | null
}): Promise<CustomerOrder[]> {
  const logisticsUrl = (process.env.LOGISTICS_APP_URL || 'https://sun-logistics.vercel.app').replace(/\/$/, '')
  if (!input.relatedTransactionId) return []
  return [{
    transactionId: input.relatedTransactionId,
    status: null,
    pickupAt: null,
    deliveryAt: null,
    trackingUrl: null,
    issue: false,
    clientClaim: false,
    logisticsUrl: `${logisticsUrl}/transactions/${encodeURIComponent(input.relatedTransactionId)}`
  }]
}
