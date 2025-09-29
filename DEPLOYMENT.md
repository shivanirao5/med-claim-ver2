# Medical Bill Processor - Deployment Guide

## 🚀 Quick Start

### Requirements
- Python 3.7 or higher
- Internet connection for OCR processing

### Installation Steps

1. **Download/Clone the Repository**
   ```bash
   git clone https://github.com/shivanirao5/med-claim-ver2.git
   cd med-claim-ver2
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set Up API Key (Optional)**
   - Create a `.env` file in the project root
   - Add your Gemini API key:
     ```
     GEMINI_API_KEY=your_api_key_here
     ```
   - Without API key, the system will work in demo mode with mock data

4. **Run the Application**
   ```bash
   python server.py
   ```

5. **Access the Application**
   - Open your browser to: http://localhost:5000
   - Start processing medical documents!

## 📋 Features Included

### ✅ User-Friendly Interface
- Step-by-step guidance for new users
- Visual icons and clear instructions
- No technical jargon or complex settings

### ✅ Smart Document Processing
- Automatic detection of bills vs prescriptions
- Medicine name extraction from handwritten prescriptions
- Amount calculation from medical bills
- Batch processing of multiple documents

### ✅ Employee Management
- Real-time search and filtering
- Daily processing summaries
- Session details in readable format
- No JSON - all data in simple language

### ✅ Enterprise Scale
- Handles 15,000+ bills per month
- Fast SQLite database backend
- Auto-migration of existing data
- Optimized for multiple users

## 🔧 Configuration

### Environment Variables
- `GEMINI_API_KEY`: Your Google Gemini API key for OCR processing
- `FLASK_ENV`: Set to 'production' for production deployment

### Production Deployment
```bash
# Install production server
pip install gunicorn

# Run with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 server:app
```

### Database
- Uses SQLite by default (no setup required)
- Database file: `med_claim_data.db`
- Automatically created on first run
- Regular backups recommended for production

## 📁 Project Structure
```
medical-bill-processor/
├── server.py              # Main Flask application
├── requirements.txt       # Dependencies
├── med_claim_data.db     # SQLite database (auto-created)
├── templates/            # HTML templates
│   ├── index.html        # Main interface
│   └── employees.html    # Employee records
├── static/              # CSS, JS, images
├── dataset/             # Processed documents (auto-organized)
└── README.md           # Documentation
```

## 🎯 Usage Guide

### For Regular Users
1. **Enter Employee Name**: Type the name in the first box
2. **Upload Documents**: Drag and drop medical images
3. **Review Results**: Check extracted medicines and amounts
4. **Save**: Data automatically saved to employee records

### For Managers
1. **View Records**: Click "View Employee Records"
2. **Search**: Type any employee name to filter instantly
3. **View Details**: Click "View Details" for session information
4. **Filter**: Use tabs for recent activity or active users

## 🔒 Security Notes
- All uploaded files are stored locally
- No data sent to external servers (except OCR API)
- Input validation and sanitization included
- Secure file handling for uploaded documents

## 🆘 Troubleshooting

### Common Issues
1. **Port 5000 in use**: Change port in server.py or stop other Flask apps
2. **Missing dependencies**: Run `pip install -r requirements.txt`
3. **Database errors**: Delete `med_claim_data.db` and restart (will recreate)
4. **OCR not working**: Check internet connection and API key

### Performance Tips
1. **Regular Cleanup**: Archive old sessions periodically
2. **Database Maintenance**: Backup database file regularly
3. **File Management**: Monitor `dataset/` folder size
4. **Memory Usage**: Restart application weekly for optimal performance

## 📞 Support
For technical support:
1. Check the application logs in terminal
2. Verify all requirements are installed
3. Ensure proper file permissions
4. Contact system administrator for deployment issues

## 🔄 Updates
To update the application:
1. Backup your `dataset/` folder and `med_claim_data.db`
2. Download new version
3. Copy back your data files
4. Restart the application

---

**Medical Bill Processor v2.0** - Simple, reliable, and user-friendly medical document processing.