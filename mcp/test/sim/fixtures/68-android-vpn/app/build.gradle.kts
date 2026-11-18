plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.shieldvpn"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.shieldvpn"
        minSdk = 24
        targetSdk = 36
        versionCode = 12
        versionName = "1.2.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
