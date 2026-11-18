plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.collage"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.collage"
        minSdk = 24
        targetSdk = 36
        versionCode = 2
        versionName = "1.0.1"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
