const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { processImage } = require('./utils/imageProcessor');
const { generateGridfinitySTL } = require('./utils/stlGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting to prevent abuse
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many uploads from this IP, please try again later.'
});

const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 downloads per windowMs
  message: 'Too many downloads from this IP, please try again later.'
});

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

// Upload and process endpoint (with rate limiting)
app.post('/upload', uploadLimiter, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const imagePath = req.file.path;
    
    // Validate that the file path is within the uploads directory (defense in depth)
    const uploadsDir = path.join(__dirname, 'uploads');
    const normalizedImagePath = path.normalize(path.resolve(imagePath));
    if (!normalizedImagePath.startsWith(uploadsDir)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }
    
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

// Download endpoint (with rate limiting and path validation)
app.get('/download/:filename', downloadLimiter, (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename to prevent path traversal attacks
  // Only allow alphanumeric characters, hyphens, dots, and underscores
  if (!/^[a-zA-Z0-9\-_.]+$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  // Ensure the file is an STL file
  if (!filename.endsWith('.stl')) {
    return res.status(400).json({ error: 'Only STL files can be downloaded' });
  }
  
  const uploadsDir = path.join(__dirname, 'uploads');
  const filePath = path.join(uploadsDir, filename);
  
  // Verify the resolved path is still within the uploads directory (prevent path traversal)
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(uploadsDir)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (fs.existsSync(normalizedPath)) {
    res.download(normalizedPath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      // Clean up file after download
      setTimeout(() => {
        if (fs.existsSync(normalizedPath)) {
          fs.unlinkSync(normalizedPath);
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
