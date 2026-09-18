# 🛡️ RAKSHA BLOCK

**AI-Powered Automatic Block Planning to Maximize Asset Availability for Train Operations on Indian Railways**  
*Smart India Hackathon 2026*

---

## 📌 Project Overview
**Raksha Block** is an intelligent maintenance scheduling and block planning platform designed for Indian Railways. It bridges the gap between infrastructure maintenance departments (P-Way, Signal & Telecom, OHE/Electrical, Mechanical) and real-time train traffic management.

By leveraging intelligent constraint-satisfaction algorithms and deterministic heuristic scheduling, Raksha Block identifies optimal maintenance windows, resolves spatial and temporal resource conflicts, eliminates train clashes, and maximizes track asset uptime without disrupting scheduled traffic.

---

## 🚀 Key Features

- **Integrated Maintenance Work Orders**: Full lifecycle tracking of maintenance requests with priority grading (Critical, High, Medium, Low) and department attribution.
- **Request-to-Block Assignment ("Find Block")**: Instant evaluation of candidate block windows against corridor headways, required safety buffers, and train schedules with automated Best Match recommendations.
- **Automated Block Planning Engine**: Algorithmic scheduling across corridors adhering to minimum safety margins, track availability, and multi-department coordination.
- **Spatial & Temporal Conflict Engine**: Real-time detection of train route overlaps, corridor clashes, and mutual resource locks.
- **Interactive Corridor Map & Live Timetables**: Visual representation of railway corridors, speed restrictions, active blocks, and running trains.
- **What-If Scenario Simulator**: Stress-test block plans by simulating train delays, priority overrides, emergency maintenance, and weather slowdowns.
- **Raksha AI Decision Support**: Context-aware assistant explaining scheduling rationale, constraint checks, and optimization trade-offs.
- **Comprehensive Analytics & Reports**: Corridor utilization KPIs, safety buffer compliance, and departmental performance audits.

---

## 🛠️ Technology Stack

- **Frontend**: Vanilla HTML5, Modern CSS, Vanilla JavaScript (ES6+), Bootstrap 5, Bootstrap Icons, Leaflet.js
- **Backend**: Node.js, Express.js
- **Data & Storage**: PostgreSQL (with embedded failover data store)
- **Architecture**: RESTful APIs with micro-service modular controllers

---

## 💻 Getting Started

### Prerequisites
- Node.js (v18 or newer recommended)
- npm

### Installation & Launch

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sufyan2k6/raksha-block.git
   cd raksha-block
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the application**:
   ```bash
   npm start
   ```

4. **Access the application**:
   - Web App: [http://localhost:3000](http://localhost:3000)
   - Dashboard: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)
   - Maintenance Requests: [http://localhost:3000/requests](http://localhost:3000/requests)
   - Block Planning: [http://localhost:3000/block-planning](http://localhost:3000/block-planning)
   - Corridor Map: [http://localhost:3000/corridor-map](http://localhost:3000/corridor-map)

---

## 👥 Demo Credentials
- **Role**: Railway Section Planner
- **Department**: P-Way / Engineering
- **Employee ID**: EMP001

---

## 📄 License
This project is licensed under the ISC License.
