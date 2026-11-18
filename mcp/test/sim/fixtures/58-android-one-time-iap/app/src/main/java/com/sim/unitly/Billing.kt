package com.sim.unitly
import com.android.billingclient.api.*
fun query(c: BillingClient) {
  val p = QueryProductDetailsParams.Product.newBuilder().setProductId("remove_ads").setProductType(BillingClient.ProductType.INAPP).build()
}
