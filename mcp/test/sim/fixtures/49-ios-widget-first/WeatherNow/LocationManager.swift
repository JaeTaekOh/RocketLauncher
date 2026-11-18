import CoreLocation
final class LocationManager: NSObject, CLLocationManagerDelegate {
  let m = CLLocationManager()
  func start() { m.requestWhenInUseAuthorization() }
}
