plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.wakeup"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.wakeup"
        minSdk = 24
        targetSdk = 36
        versionCode = 5
        versionName = "1.1.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
