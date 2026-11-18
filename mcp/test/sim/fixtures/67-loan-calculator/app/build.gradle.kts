plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sim.budgetly"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sim.budgetly"
        minSdk = 24
        targetSdk = 36
        versionCode = 6
        versionName = "1.6.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")

}
