fetch('http://localhost:5000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin' })
})
.then(r => r.text())
.then(console.log)
.catch(console.error);
