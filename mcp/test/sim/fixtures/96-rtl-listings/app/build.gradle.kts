plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.qibla"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.qibla"
        minSdk = 24
        targetSdk = 36
        versionCode = 9
        versionName = "1.9.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
