import http from 'http';

http.get('http://127.0.0.1:80/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Status Code:", res.statusCode);
    console.log("Response:", data);
  });
}).on('error', (err) => {
  console.error("HTTP Request Error:", err.message);
});
