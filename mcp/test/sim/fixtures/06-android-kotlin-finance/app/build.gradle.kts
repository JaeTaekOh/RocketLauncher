plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "com.sim.pocketledger"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.sim.pocketledger"
        minSdk = 24
        targetSdk = 36
        versionCode = 21
        versionName = "2.4.0"
    }
}
dependencies {
    implementation("com.android.billingclient:billing-ktx:7.1.1")
    implementation("com.google.firebase:firebase-analytics")
    implementation("com.google.firebase:firebase-crashlytics")
    implementation("androidx.room:room-runtime:2.6.1")
}
