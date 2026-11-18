plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.scanly"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.scanly"
        minSdk = 24
        targetSdk = 36
        versionCode = 4
        versionName = "1.3.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
