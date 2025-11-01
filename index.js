const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processImage } = require('./utils/imageProcessor');
const { generateGridfinitySTL } = require('./utils/stlGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpg, jpeg, png) are allowed!'));
    }
  }
});

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Upload and process endpoint
app.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imagePath = req.file.path;
    
    // Process the image to get dimensions
    const dimensions = await processImage(imagePath);
    
    if (!dimensions) {
      return res.status(400).json({ error: 'Could not detect A4 paper in the image' });
    }

    // Generate STL file
    const stlData = await generateGridfinitySTL(dimensions);
    
    // Save STL file
    const stlFilename = `gridfinity-${Date.now()}.stl`;
    const stlPath = path.join('uploads', stlFilename);
    fs.writeFileSync(stlPath, stlData);

    // Clean up uploaded image
    fs.unlinkSync(imagePath);

    res.json({
      success: true,
      dimensions: dimensions,
      downloadUrl: `/download/${stlFilename}`
    });

  } catch (error) {
    console.error('Error processing image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download endpoint
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      // Clean up file after download
      setTimeout(() => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }, 5000);
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
