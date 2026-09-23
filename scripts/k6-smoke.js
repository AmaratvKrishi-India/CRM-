import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function smokeRequest() {
  const response = http.get(__ENV.TARGET_URL || 'http://127.0.0.1:4174/');
  check(response, {
    'response is successful': (value) => value.status >= 200 && value.status < 400,
  });
}
