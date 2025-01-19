const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware to set cross-origin isolation headers
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    next();
});

// Serve static files from the build directory
app.use(express.static(path.join(__dirname, 'ui/build')));

// Handle requests for specific files or fallback to index.html
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, 'ui/build', req.path);

    // Check if the requested file exists
    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        res.sendFile(filePath);
    } else {
        // Fallback to React's index.html for client-side routing
        res.sendFile(path.join(__dirname, 'ui/build', 'index.html'));
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});