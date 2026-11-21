import CoreLocation
import ExpoModulesCore
import MapKit

/// Walking route between two points with Apple MapKit (no API key, works with Apple Maps data).
public class AedRoutingModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AedRouting")

    AsyncFunction("walkingRoute") { (fromLat: Double, fromLon: Double, toLat: Double, toLon: Double, promise: Promise) in
      let request = MKDirections.Request()
      request.source = Self.mapItem(fromLat, fromLon)
      request.destination = Self.mapItem(toLat, toLon)
      request.transportType = .walking
      request.requestsAlternateRoutes = false

      MKDirections(request: request).calculate { response, error in
        guard let route = response?.routes.first else {
          promise.reject("E_NO_ROUTE", error?.localizedDescription ?? "Brak trasy pieszej")
          return
        }
        let count = route.polyline.pointCount
        var coords = [CLLocationCoordinate2D](repeating: kCLLocationCoordinate2DInvalid, count: count)
        route.polyline.getCoordinates(&coords, range: NSRange(location: 0, length: count))
        promise.resolve([
          "distance": route.distance,
          "duration": route.expectedTravelTime,
          "coordinates": coords.map { ["latitude": $0.latitude, "longitude": $0.longitude] },
        ])
      }
    }
  }

  private static func mapItem(_ lat: Double, _ lon: Double) -> MKMapItem {
    let coordinate = CLLocationCoordinate2D(latitude: lat, longitude: lon)
    if #available(iOS 26.0, *) {
      return MKMapItem(location: CLLocation(latitude: lat, longitude: lon), address: nil)
    }
    return MKMapItem(placemark: MKPlacemark(coordinate: coordinate))
  }
}
