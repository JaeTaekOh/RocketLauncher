plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.streaks"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.streaks"
        minSdk = 24
        targetSdk = 36
        versionCode = 3
        versionName = "1.0.2"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
