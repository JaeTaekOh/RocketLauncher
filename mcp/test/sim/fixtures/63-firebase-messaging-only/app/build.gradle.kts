plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.alerts"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.alerts"
        minSdk = 24
        targetSdk = 36
        versionCode = 5
        versionName = "1.0.4"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.google.firebase:firebase-messaging:24.1.0")
}
