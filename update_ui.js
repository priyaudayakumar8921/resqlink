const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Update styling classes for a softer, more modern look
html = html.replace(/rounded-xl/g, 'rounded-3xl');
html = html.replace(/rounded-lg/g, 'rounded-2xl');
html = html.replace(/shadow-sm/g, 'shadow-[0_8px_30px_rgb(56,25,50,0.06)]');
html = html.replace(/border-borderBlue/g, 'border-borderBlue'); // Actually leave borderBlue alone as I already updated its hex code in tailwind.config.js to #EADACD

// Update bottom nav bar
html = html.replace(
    '<nav class="md:hidden fixed bottom-0 w-full bg-white border-t border-borderBlue flex justify-around items-center pb-safe pt-1 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">',
    '<nav class="md:hidden fixed bottom-4 left-4 right-4 bg-white/90 backdrop-blur-xl border border-borderBlue flex justify-around items-center p-2 z-50 shadow-2xl rounded-full">'
);

fs.writeFileSync('index.html', html);
console.log("index.html updated successfully!");
