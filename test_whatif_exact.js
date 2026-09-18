const http = require('http');

function post(path, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function testWhatIf() {
    console.log('--- TEST 1: POST /api/what-if with 18:30 (Off-Peak) ---');
    const res1 = await post('/api/what-if', { corridor: 'Corridor C2', startTime: '18:30' });
    console.log('Status:', res1.status);
    console.log('Response:', JSON.stringify(res1.data, null, 2));

    console.log('\n--- TEST 2: POST /api/what-if with 17:00 (Peak Hour clash with Freight T310) ---');
    const res2 = await post('/api/what-if', { corridor: 'Corridor C2', startTime: '17:00' });
    console.log('Status:', res2.status);
    console.log('Response:', JSON.stringify(res2.data, null, 2));

    console.log('\n--- TEST 3: POST /api/what-if/run backward compatibility ---');
    const res3 = await post('/api/what-if/run', { startTimeShift: '18:30' });
    console.log('Status:', res3.status);
    console.log('Success:', res3.data.success, 'Feasible:', res3.data.feasible);
}

testWhatIf();
