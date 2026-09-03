# ClassCore Installation Guide

## System Requirements

### Minimum Requirements
- **OS**: Windows 7 SP1 / macOS 10.12+ / Ubuntu 16.04+
- **Processor**: Intel Core i3 or equivalent
- **RAM**: 2 GB
- **Storage**: 500 MB free space
- **Network**: Internet connection (for Firebase sync)

### Recommended Requirements
- **OS**: Windows 10/11, macOS 11+, Ubuntu 20.04+
- **Processor**: Intel Core i5 or equivalent
- **RAM**: 4 GB or more
- **Storage**: 1 GB SSD
- **Network**: High-speed internet connection

## Windows Installation

### Step 1: Download
1. Visit [ClassCore Releases](https://github.com/prajapatikuldeep455-source/classcore-tuition/releases)
2. Download `ClassCore-Setup-v2.0.0.exe`
3. Ensure your antivirus allows the download

### Step 2: Run Installer
1. Double-click the downloaded `.exe` file
2. Click "Yes" if prompted by User Account Control
3. Follow the installation wizard
4. Choose installation location (default: C:\Program Files\ClassCore)
5. Select additional tasks:
   - ✓ Create desktop shortcut
   - ✓ Add to Start Menu

### Step 3: Launch Application
1. Click "Finish" in the installer
2. Launch from desktop shortcut or Start Menu
3. Configure initial settings

### Step 4: Uninstall (if needed)
- Go to Control Panel → Programs → Programs and Features
- Find "ClassCore"
- Click "Uninstall"

---

## macOS Installation

### Step 1: Download
1. Visit [ClassCore Releases](https://github.com/prajapatikuldeep455-source/classcore-tuition/releases)
2. Download `ClassCore-v2.0.0.dmg`
3. Wait for download to complete

### Step 2: Mount Disk Image
1. Double-click the `.dmg` file
2. Drag ClassCore.app to Applications folder
3. Wait for copy process to complete

### Step 3: Grant Permissions
1. Go to Applications folder
2. Right-click ClassCore.app
3. Select "Open"
4. Click "Open" in the security dialog

### Step 4: Launch Application
- Double-click ClassCore.app or use Spotlight search

### Step 5: Uninstall (if needed)
- Drag ClassCore.app to Trash
- Empty Trash

---

## Linux Installation

### Ubuntu/Debian

```bash
# Download the AppImage
wget https://github.com/prajapatikuldeep455-source/classcore-tuition/releases/download/v2.0.0/ClassCore-v2.0.0.AppImage

# Make executable
chmod +x ClassCore-v2.0.0.AppImage

# Run application
./ClassCore-v2.0.0.AppImage
```

### Create Desktop Shortcut

```bash
# Create .desktop file
cat > ~/.local/share/applications/classcore.desktop << EOF
[Desktop Entry]
Name=ClassCore
Exec=/path/to/ClassCore-v2.0.0.AppImage
Icon=application-x-executable
Type=Application
Categories=Office;
EOF

# Update menu
update-desktop-database ~/.local/share/applications/
```

---

## Developer Installation

### Prerequisites
- **Node.js**: v14.0.0 or higher
- **npm**: v6.0.0 or higher
- **Git**: Latest version

### Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/prajapatikuldeep455-source/classcore-tuition.git
cd classcore-tuition

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Add Firebase credentials to .env
# Edit .env with your Firebase config

# 5. Run development server
npm start

# 6. Build for production
npm run build

# 7. Create installer (Windows)
npm run dist
```

---

## First Launch Configuration

### Initial Setup Wizard

1. **Create Admin Account**
   - Username: (your choice)
   - Password: (minimum 8 characters)
   - Email: (valid email address)

2. **Center Information**
   - Center Name: (your tuition center name)
   - Address: (center location)
   - Phone: (contact number)
   - Logo: (upload center logo)

3. **Academic Configuration**
   - Academic Year: (e.g., 2024-2025)
   - Grades: (select applicable grades)
   - Subjects: (add your subjects)

4. **Financial Setup**
   - Currency: (select your currency)
   - Fee Structure: (monthly/annual)
   - Default Fee Amount: (set amount)

---

## Troubleshooting

### Application Won't Start

**Windows:**
- Reinstall .NET Framework
- Check Windows Defender exclusions
- Try running as Administrator

**macOS:**
- Verify app is from trusted developer (System Preferences → Security)
- Check disk space availability
- Try Safe mode

**Linux:**
- Check GLIBC version compatibility
- Install missing dependencies: `sudo apt install libxss1`
- Try running with: `./ClassCore-v2.0.0.AppImage --no-sandbox`

### Firebase Connection Issues
- Verify internet connection
- Check .env Firebase credentials
- Ensure Firebase project is active
- Check firewall/proxy settings

### Performance Issues
- Close unnecessary applications
- Increase available RAM
- Clear cache: Settings → Advanced → Clear Cache
- Update graphics drivers

### Database Sync Problems
- Check internet connection
- Manually sync: Settings → Sync Now
- Clear local database: Settings → Reset Local Data
- Contact support with error logs

---

## Upgrading ClassCore

### From Previous Version

1. **Backup Current Data**
   ```bash
   Settings → Backup & Recovery → Create Backup
   ```

2. **Download New Version**
   - Download latest installer from releases

3. **Run New Installer**
   - Existing settings will be preserved
   - Database will auto-migrate

4. **Restart Application**
   - Close and reopen ClassCore

---

## Getting Help

- **Documentation**: [Wiki](https://github.com/prajapatikuldeep455-source/classcore-tuition/wiki)
- **Issues**: [Report Issues](https://github.com/prajapatikuldeep455-source/classcore-tuition/issues)
- **Support**: support@classcore.local

---

**Happy using ClassCore! 🚀**
