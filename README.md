# IT Inventory Management System - Beta

A comprehensive inventory management web application built with React and Python, featuring authentication, real-time inventory tracking, and advanced reporting capabilities.

## 🌐 Live Demo

**Beta Version (Authentication Required):** [Coming Soon - Deploy to Render.com]

## 🚀 Features

- **🧪 BETA Version** with advanced authentication system
- **Role-based Access Control** (Admin/Team permissions)
- **Real-time Inventory Management** with barcode scanning
- **Advanced PDF Processing** for shipment cost allocation
- **Multi-method Data Import** (CSV, manual entry, barcode)
- **Comprehensive Reporting** and checkout history
- **Mobile-friendly** responsive design

## 🔐 Authentication

The beta version includes a secure authentication system:

- **Admin Accounts:**
  - `admin@company.com` / `admin123`
  - `manager@company.com` / `manager123`

- **Team Accounts:**
  - `john.doe@company.com` / `team123`
  - `jane.smith@company.com` / `team123`
  - `mike.wilson@company.com` / `team123`

## 🛠️ Local Development

### Prerequisites
- Python 3.8+
- Modern web browser

### Quick Start

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd it-inventory-app
   ```

2. **Run locally:**
   ```bash
   python3 web-server.py
   ```

3. **Access the application:**
   - Beta: http://localhost:10000

## 🌍 Deployment

### Deploy to Render.com (Free)

1. **Fork this repository to your GitHub**

2. **Connect to Render.com:**
   - Sign up at [render.com](https://render.com)
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` configuration

3. **Deploy:**
   - Click "Deploy" 
   - Your app will be live at: `https://your-app-name.onrender.com`

### Manual Deployment

The application includes:
- `render.yaml` - Render.com configuration
- `web-server.py` - Production web server
- `simple_api_server.py` - Lightweight API server
- `requirements.txt` - Python dependencies (none required)

## 📊 Architecture

- **Frontend:** React (via CDN) with Tailwind CSS
- **Backend:** Python HTTP server with SQLite API
- **Database:** SQLite with full CRUD operations
- **Authentication:** Session-based with localStorage persistence
- **File Processing:** PDF.js, PDF-lib for document handling

## 🔧 Configuration

### Environment Variables

- `PORT` - Web server port (default: 10000)
- `ENVIRONMENT` - Set to 'production' for deployment

### API Endpoints

- `GET /items` - Retrieve inventory items
- `GET /users` - Retrieve users  
- `GET /checkoutHistory` - Retrieve checkout records

## 📱 Usage

1. **Login** with provided demo credentials
2. **Browse inventory** in the Shop tab
3. **Manage users** (Admin only) 
4. **Process shipments** with PDF receipt analysis
5. **View reports** and checkout history
6. **Configure permissions** via Admin Settings

## 🛡️ Security Features

- Role-based access control
- Session management
- CORS protection
- Input validation
- Secure headers in production

## 🤝 Contributing

This is an internal IT inventory management system. Contact the administrator for access or feature requests.

## 📄 License

Internal use only - Proprietary software for company inventory management.

---

**Built with ❤️ for efficient IT inventory management**