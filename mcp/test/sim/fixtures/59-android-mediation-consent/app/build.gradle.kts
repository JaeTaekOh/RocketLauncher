plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.tilerush"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.tilerush"
        minSdk = 24
        targetSdk = 36
        versionCode = 15
        versionName = "1.5.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("com.applovin:applovin-sdk:13.0.1")
    implementation("com.applovin.mediation:unityads-adapter:4.12.4.0")
    implementation("com.applovin.mediation:facebook-adapter:6.18.0.0")
    implementation("com.unity3d.ads:unity-ads:4.12.4")
    implementation("com.facebook.android:audience-network-sdk:6.18.0")
    implementation("com.google.android.ump:user-messaging-platform:3.1.0")
}
