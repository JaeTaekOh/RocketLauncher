plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.unitly"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.unitly"
        minSdk = 24
        targetSdk = 36
        versionCode = 21
        versionName = "2.1.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.android.billingclient:billing-ktx:7.1.1")
    implementation("com.google.android.gms:play-services-ads:23.6.0")
    implementation("com.google.android.ump:user-messaging-platform:3.1.0")
}
