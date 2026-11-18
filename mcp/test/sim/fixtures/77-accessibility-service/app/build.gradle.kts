plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.autotap"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.autotap"
        minSdk = 24
        targetSdk = 36
        versionCode = 4
        versionName = "1.0.3"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
