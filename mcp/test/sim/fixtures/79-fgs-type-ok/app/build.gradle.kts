plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.podly"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.podly"
        minSdk = 24
        targetSdk = 36
        versionCode = 7
        versionName = "1.7.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
