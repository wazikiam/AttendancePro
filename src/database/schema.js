"use strict";
// Attendance Pro Database Schema
// SQL.js (pure JavaScript SQLite) implementation
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
exports.getDatabase = getDatabase;
exports.databaseExists = databaseExists;
const sql_js_1 = __importDefault(require("sql.js"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
class DatabaseManager {
    constructor(config) {
        this.db = null;
        this.SQL = null;
        const userDataPath = electron_1.app.getPath('userData');
        this.config = {
            databasePath: path.join(userDataPath, 'attendance-pro.db'),
            wasmPath: path.join(electron_1.app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
            ...config
        };
    }
    async initialize() {
        try {
            // Load SQL.js
            this.SQL = await (0, sql_js_1.default)({
                locateFile: (file) => {
                    // First try to find in app resources
                    const resourcePath = path.join(process.resourcesPath, 'app.asar.unpacked', file);
                    if (fs.existsSync(resourcePath)) {
                        return resourcePath;
                    }
                    // Then try in node_modules
                    const nodeModulesPath = this.config.wasmPath ||
                        path.join(electron_1.app.getAppPath(), 'node_modules', 'sql.js', 'dist', file);
                    if (fs.existsSync(nodeModulesPath)) {
                        return nodeModulesPath;
                    }
                    // Fallback to relative path
                    return file;
                }
            });
            // Create database directory if it doesn't exist
            const dbDir = path.dirname(this.config.databasePath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
            // Load or create database
            if (fs.existsSync(this.config.databasePath)) {
                const dbBuffer = fs.readFileSync(this.config.databasePath);
                this.db = new this.SQL.Database(dbBuffer);
            }
            else {
                this.db = new this.SQL.Database();
                this.createTables();
                this.createDefaultAdmin();
                this.saveToFile(); // Save initial empty database
            }
            console.log('Database initialized successfully at:', this.config.databasePath);
        }
        catch (error) {
            console.error('Database initialization failed:', error);
            throw error;
        }
    }
    createTables() {
        if (!this.db || !this.SQL) {
            throw new Error('Database not initialized');
        }
        // Users table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'teacher', 'assistant', 'viewer')),
        full_name TEXT NOT NULL,
        phone TEXT,
        is_active BOOLEAN DEFAULT 1,
        permissions TEXT DEFAULT '{}',
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Classes table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        schedule TEXT NOT NULL DEFAULT '{}',
        instructor_id INTEGER,
        max_capacity INTEGER,
        current_enrollment INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'full')),
        start_date DATE NOT NULL,
        end_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
        // Subscribers table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        id_number TEXT UNIQUE NOT NULL,
        photo_path TEXT,
        documents_path TEXT,
        class_id INTEGER,
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
        notes TEXT,
        address TEXT,
        date_of_birth DATE,
        emergency_contact TEXT,
        emergency_phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL
      )
    `);
        // Subscriptions table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER NOT NULL,
        class_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        payment_status TEXT NOT NULL DEFAULT 'pending' 
          CHECK(payment_status IN ('paid', 'pending', 'overdue', 'cancelled')),
        amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        payment_method TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
        UNIQUE(subscriber_id, class_id, start_date)
      )
    `);
        // Attendance table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER NOT NULL,
        date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'absent' 
          CHECK(status IN ('present', 'absent', 'late', 'excused', 'holiday')),
        check_in_time DATETIME,
        check_out_time DATETIME,
        notes TEXT,
        recorded_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE,
        FOREIGN KEY (recorded_by) REFERENCES users(id),
        UNIQUE(subscriber_id, date)
      )
    `);
        // Audit log table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
        // Create indexes
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_subscribers_class_id ON subscribers(class_id)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_subscriber_date ON attendance(subscriber_id, date)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_subscriptions_dates ON subscriptions(start_date, end_date)`);
        this.db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at)`);
    }
    createDefaultAdmin() {
        if (!this.db || !this.SQL) {
            throw new Error('Database not initialized');
        }
        // Check if any users exist
        const checkStmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
        checkStmt.step();
        const result = checkStmt.getAsObject();
        checkStmt.free();
        if (result.count === 0) {
            // Create default admin user (password: admin123)
            const defaultPassword = 'admin123'; // TODO: Hash password
            const insertStmt = this.db.prepare(`
        INSERT INTO users (username, email, password_hash, role, full_name, is_active, permissions)
        VALUES (:username, :email, :password, :role, :full_name, :is_active, :permissions)
      `);
            insertStmt.bind({
                ':username': 'admin',
                ':email': 'admin@attendancepro.local',
                ':password': defaultPassword,
                ':role': 'admin',
                ':full_name': 'System Administrator',
                ':is_active': 1,
                ':permissions': JSON.stringify({
                    can_manage_users: true,
                    can_manage_subscribers: true,
                    can_manage_classes: true,
                    can_mark_attendance: true,
                    can_view_reports: true,
                    can_export_data: true,
                    can_configure_system: true
                })
            });
            insertStmt.step();
            insertStmt.free();
            console.log('Default admin user created');
        }
    }
    saveToFile() {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(this.config.databasePath, buffer);
    }
    close() {
        if (this.db) {
            this.saveToFile();
            this.db.close();
            this.db = null;
        }
    }
    backup(destinationPath) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        // Create backup directory
        const backupDir = path.dirname(destinationPath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        // Save current database state
        this.saveToFile();
        // Copy database file
        fs.copyFileSync(this.config.databasePath, destinationPath);
        console.log(`Database backed up to: ${destinationPath}`);
    }
    getDatabaseStats() {
        const stats = {
            subscribers: 0,
            active_subscribers: 0,
            classes: 0,
            attendance_records: 0,
            users: 0,
            database_size: 0
        };
        if (!this.db) {
            return stats;
        }
        try {
            // Get counts
            const subscribersResult = this.db.exec('SELECT COUNT(*) as count FROM subscribers');
            const activeSubscribersResult = this.db.exec('SELECT COUNT(*) as count FROM subscribers WHERE status = "active"');
            const classesResult = this.db.exec('SELECT COUNT(*) as count FROM classes WHERE status = "active"');
            const attendanceResult = this.db.exec('SELECT COUNT(*) as count FROM attendance');
            const usersResult = this.db.exec('SELECT COUNT(*) as count FROM users WHERE is_active = 1');
            stats.subscribers = subscribersResult.length > 0 ? subscribersResult[0].values[0][0] : 0;
            stats.active_subscribers = activeSubscribersResult.length > 0 ? activeSubscribersResult[0].values[0][0] : 0;
            stats.classes = classesResult.length > 0 ? classesResult[0].values[0][0] : 0;
            stats.attendance_records = attendanceResult.length > 0 ? attendanceResult[0].values[0][0] : 0;
            stats.users = usersResult.length > 0 ? usersResult[0].values[0][0] : 0;
            // Get database file size
            if (fs.existsSync(this.config.databasePath)) {
                stats.database_size = fs.statSync(this.config.databasePath).size;
            }
        }
        catch (error) {
            console.error('Error getting database stats:', error);
        }
        return stats;
    }
    // Query methods
    query(sql, params = {}) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        try {
            const stmt = this.db.prepare(sql);
            // Bind parameters
            Object.keys(params).forEach(key => {
                stmt.bind({ [`:${key}`]: params[key] });
            });
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return results;
        }
        catch (error) {
            console.error('Query error:', error, 'SQL:', sql);
            throw error;
        }
    }
    queryOne(sql, params = {}) {
        const results = this.query(sql, params);
        return results.length > 0 ? results[0] : null;
    }
    execute(sql, params = {}) {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        try {
            const stmt = this.db.prepare(sql);
            // Bind parameters
            Object.keys(params).forEach(key => {
                stmt.bind({ [`:${key}`]: params[key] });
            });
            stmt.step();
            stmt.free();
            // Auto-save after modifications
            if (sql.trim().toUpperCase().startsWith('INSERT') ||
                sql.trim().toUpperCase().startsWith('UPDATE') ||
                sql.trim().toUpperCase().startsWith('DELETE')) {
                this.saveToFile();
            }
        }
        catch (error) {
            console.error('Execute error:', error, 'SQL:', sql);
            throw error;
        }
    }
    getDatabase() {
        return this.db;
    }
}
exports.DatabaseManager = DatabaseManager;
// Singleton instance
let databaseInstance = null;
async function getDatabase() {
    if (!databaseInstance) {
        databaseInstance = new DatabaseManager();
        await databaseInstance.initialize();
    }
    return databaseInstance;
}
function databaseExists() {
    const userDataPath = electron_1.app.getPath('userData');
    const dbPath = path.join(userDataPath, 'attendance-pro.db');
    return fs.existsSync(dbPath);
}
// Initialize database on module load (optional)
// getDatabase().catch(console.error);
