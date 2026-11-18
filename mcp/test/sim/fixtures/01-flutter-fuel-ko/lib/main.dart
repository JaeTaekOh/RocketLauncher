import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
Future<void> load() async {
  final pos = await Geolocator.getCurrentPosition();
  await http.get(Uri.parse('https://api.gaspump.app/stations?lat=${pos.latitude}&lng=${pos.longitude}'));
}
