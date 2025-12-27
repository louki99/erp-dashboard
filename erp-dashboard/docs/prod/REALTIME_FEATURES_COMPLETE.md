# Real-Time Features Implementation - Complete Guide

**Date:** December 24, 2025  
**Status:** ✅ IMPLEMENTED  
**Features:** WebSocket/SSE Push Updates, Task Notifications, SLA Tracking

---

## Overview

Three advanced features have been implemented to provide real-time monitoring and proactive alerts:

1. **WebSocket/SSE Real-Time Updates** - Push updates instead of polling
2. **Task Notifications** - Notify users when tasks become ready
3. **SLA Tracking** - Alert when tasks exceed expected duration

---

## 1. WebSocket/SSE Real-Time Updates

### Events Created

#### `TaskStatusChanged`
**File:** `app/Events/TaskStatusChanged.php`

**Broadcasts when:** Task status changes (pending → ready → in_progress → completed)

**Channels:**
- `workflow.{type}.{id}` - Workflow-specific channel
- `task.{taskId}` - Task-specific channel
- `user.{userId}.tasks` - User-specific channel (for assigned users)

**Payload:**
```json
{
  "task_id": 123,
  "task_code": "ADV_REVIEW_BC114",
  "task_name": "ADV Review",
  "workflow_type": "bc",
  "taskable_type": "Order",
  "taskable_id": 114,
  "old_status": "ready",
  "new_status": "completed",
  "can_start": false,
  "changed_by": 5,
  "changed_at": "2025-12-24T10:15:00Z"
}
```

---

#### `TaskBecameReady`
**File:** `app/Events/TaskBecameReady.php`

**Broadcasts when:** Task becomes ready (all dependencies satisfied)

**Channels:**
- `workflow.{type}.{id}` - Workflow-specific
- `user.{userId}.tasks` - Assigned users
- `role.{roleName}.tasks` - Assigned roles

**Payload:**
```json
{
  "task_id": 124,
  "task_code": "CONVERT_TO_BL_BC114",
  "task_name": "Convert to BL",
  "task_type": "conversion",
  "workflow_type": "bc",
  "taskable_type": "Order",
  "taskable_id": 114,
  "timeout_minutes": 30,
  "assignments": [
    {
      "type": "role",
      "user_id": null,
      "role_name": "dispatcher"
    }
  ],
  "became_ready_at": "2025-12-24T10:15:00Z"
}
```

---

#### `TaskSLAExceeded`
**File:** `app/Events/TaskSLAExceeded.php`

**Broadcasts when:** Task exceeds its timeout/SLA

**Channels:**
- `workflow.{type}.{id}` - Workflow-specific
- `admin.sla.alerts` - Admin alert channel
- `user.{userId}.tasks` - Assigned users

**Payload:**
```json
{
  "task_id": 125,
  "task_code": "ADV_REVIEW_BC115",
  "task_name": "ADV Review",
  "workflow_type": "bc",
  "taskable_type": "Order",
  "taskable_id": 115,
  "timeout_minutes": 30,
  "exceeded_by_minutes": 45,
  "started_at": "2025-12-24T09:00:00Z",
  "alert_level": "high",
  "alerted_at": "2025-12-24T09:45:00Z"
}
```

**Alert Levels:**
- `critical` - Exceeded by > 120 minutes
- `high` - Exceeded by > 60 minutes
- `medium` - Exceeded by > 30 minutes
- `low` - Exceeded by < 30 minutes

---

## 2. Task Notifications

### Notifications Created

#### `TaskReadyNotification`
**File:** `app/Notifications/TaskReadyNotification.php`

**Sent when:** Task becomes ready for user to work on

**Channels:** `database`, `broadcast`

**Database Payload:**
```json
{
  "task_id": 124,
  "task_code": "CONVERT_TO_BL_BC114",
  "task_name": "Convert to BL",
  "task_type": "conversion",
  "workflow_type": "bc",
  "taskable_type": "Order",
  "taskable_id": 114,
  "timeout_minutes": 30,
  "message": "Task 'Convert to BL' is ready for you",
  "action_url": "http://localhost:8000/admin/tasks/124"
}
```

---

#### `TaskSLAExceededNotification`
**File:** `app/Notifications/TaskSLAExceededNotification.php`

**Sent when:** Task exceeds SLA timeout

**Channels:** `database`, `broadcast`, `mail`

**Email Subject:** `⚠️ SLA Alert: Task Overdue - {task_name}`

**Database Payload:**
```json
{
  "task_id": 125,
  "task_code": "ADV_REVIEW_BC115",
  "task_name": "ADV Review",
  "workflow_type": "bc",
  "taskable_type": "Order",
  "taskable_id": 115,
  "timeout_minutes": 30,
  "exceeded_by_minutes": 45,
  "alert_level": "high",
  "message": "Task 'ADV Review' exceeded SLA by 45 minutes",
  "action_url": "http://localhost:8000/admin/tasks/125"
}
```

---

## 3. SLA Tracking Service

### Service: `TaskSLATrackingService`
**File:** `app/Services/TaskSLATrackingService.php`

#### Methods

##### `checkSLAViolations(): array`
Checks all in-progress tasks for SLA violations

**Returns:**
```php
[
    [
        'task_id' => 125,
        'task_code' => 'ADV_REVIEW_BC115',
        'exceeded_by' => 45
    ]
]
```

---

##### `getSLAStatistics(): array`
Get overall SLA compliance statistics

**Returns:**
```json
{
  "total_in_progress": 15,
  "on_time": 10,
  "at_risk": 3,
  "exceeded": 2,
  "compliance_rate": 66.67
}
```

---

##### `getTasksAtRisk(): array`
Get tasks at risk of SLA violation (< 20% time remaining)

**Returns:**
```json
[
  {
    "task_id": 126,
    "task_code": "CONVERT_TO_BL_BC116",
    "task_name": "Convert to BL",
    "workflow_type": "bc",
    "remaining_minutes": 5,
    "timeout_minutes": 30,
    "risk_level": "critical"
  }
]
```

**Risk Levels:**
- `exceeded` - Already exceeded
- `critical` - < 10% time remaining
- `high` - < 20% time remaining
- `medium` - < 50% time remaining
- `low` - > 50% time remaining

---

### Alert Frequency (Anti-Spam)

To avoid notification spam, alerts are sent based on severity:

| Exceeded By | Alert Frequency |
|-------------|-----------------|
| > 120 min (critical) | Every 15 minutes |
| > 60 min (high) | Every 30 minutes |
| > 30 min (medium) | Every 60 minutes |
| < 30 min (low) | Every 2 hours |

---

## 4. Scheduled Command

### Command: `MonitorTaskSLA`
**File:** `app/Console/Commands/MonitorTaskSLA.php`

**Run:**
```bash
php artisan tasks:monitor-sla
```

**Schedule in `app/Console/Kernel.php`:**
```php
protected function schedule(Schedule $schedule)
{
    // Check SLA every 5 minutes
    $schedule->command('tasks:monitor-sla')->everyFiveMinutes();
}
```

**Output:**
```
Checking for SLA violations...
Found 2 SLA violations
  - Task ADV_REVIEW_BC115 exceeded by 45 minutes
  - Task CONVERT_TO_BL_BC116 exceeded by 15 minutes

SLA Statistics:
  Total in progress: 15
  On time: 10
  At risk: 3
  Exceeded: 2
  Compliance rate: 66.67%
```

---

## 5. API Endpoints

### Get SLA Statistics
```http
GET /api/backend/tasks/sla/statistics
```

**Response:**
```json
{
  "success": true,
  "statistics": {
    "total_in_progress": 15,
    "on_time": 10,
    "at_risk": 3,
    "exceeded": 2,
    "compliance_rate": 66.67
  }
}
```

---

### Get Tasks At Risk
```http
GET /api/backend/tasks/sla/at-risk
```

**Response:**
```json
{
  "success": true,
  "tasks_at_risk": [
    {
      "task_id": 126,
      "task_code": "CONVERT_TO_BL_BC116",
      "task_name": "Convert to BL",
      "workflow_type": "bc",
      "remaining_minutes": 5,
      "timeout_minutes": 30,
      "risk_level": "critical"
    }
  ],
  "count": 1
}
```

---

## 6. Frontend Integration

### Laravel Echo Setup (Broadcasting)

**Install Laravel Echo:**
```bash
npm install --save laravel-echo pusher-js
```

**Configure `resources/js/bootstrap.js`:**
```javascript
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: 'pusher',
    key: process.env.MIX_PUSHER_APP_KEY,
    cluster: process.env.MIX_PUSHER_APP_CLUSTER,
    forceTLS: true,
    encrypted: true,
    authEndpoint: '/broadcasting/auth',
});
```

---

### React Component: Real-Time Workflow Monitor

```javascript
import { useEffect, useState } from 'react';
import Echo from 'laravel-echo';

const WorkflowMonitor = ({ orderId, workflowType = 'bc' }) => {
  const [progress, setProgress] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Initial fetch
    fetchProgress();

    // Subscribe to workflow channel
    const channel = Echo.private(`workflow.${workflowType}.${orderId}`)
      .listen('.task.status.changed', (e) => {
        console.log('Task status changed:', e);
        fetchProgress(); // Refresh progress
        
        if (e.new_status === 'completed') {
          showToast(`Task "${e.task_name}" completed!`, 'success');
        }
      })
      .listen('.task.became.ready', (e) => {
        console.log('Task became ready:', e);
        fetchProgress();
        showToast(`Task "${e.task_name}" is ready!`, 'info');
      })
      .listen('.task.sla.exceeded', (e) => {
        console.log('SLA exceeded:', e);
        showToast(
          `⚠️ Task "${e.task_name}" exceeded SLA by ${e.exceeded_by_minutes} minutes!`,
          'error'
        );
      });

    return () => {
      channel.stopListening('.task.status.changed');
      channel.stopListening('.task.became.ready');
      channel.stopListening('.task.sla.exceeded');
      Echo.leave(`workflow.${workflowType}.${orderId}`);
    };
  }, [orderId, workflowType]);

  const fetchProgress = async () => {
    const { data } = await axios.get(
      `/api/backend/tasks/workflow/${workflowType}/Order/${orderId}/progress`
    );
    setProgress(data.progress);
  };

  return (
    <div>
      <h2>Workflow Progress: {progress?.progress_percentage}%</h2>
      <ReactFlow nodes={nodes} edges={edges} />
    </div>
  );
};
```

---

### User Notifications Component

```javascript
const UserNotifications = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Subscribe to user's task channel
    Echo.private(`user.${userId}.tasks`)
      .listen('.task.became.ready', (e) => {
        addNotification({
          type: 'task_ready',
          message: `Task "${e.task_name}" is ready for you`,
          taskId: e.task_id,
          timestamp: new Date(),
        });
        
        // Play notification sound
        playNotificationSound();
      })
      .notification((notification) => {
        addNotification({
          type: notification.type,
          message: notification.message,
          taskId: notification.task_id,
          timestamp: new Date(),
        });
      });

    return () => {
      Echo.leave(`user.${userId}.tasks`);
    };
  }, [userId]);

  const addNotification = (notification) => {
    setNotifications(prev => [notification, ...prev].slice(0, 10));
  };

  return (
    <div className="notifications-panel">
      {notifications.map((notif, index) => (
        <div key={index} className={`notification ${notif.type}`}>
          <p>{notif.message}</p>
          <small>{notif.timestamp.toLocaleTimeString()}</small>
        </div>
      ))}
    </div>
  );
};
```

---

### SLA Dashboard Component

```javascript
const SLADashboard = () => {
  const [stats, setStats] = useState(null);
  const [atRisk, setAtRisk] = useState([]);

  useEffect(() => {
    fetchSLAData();
    const interval = setInterval(fetchSLAData, 30000); // Refresh every 30s

    // Subscribe to admin SLA alerts
    Echo.private('admin.sla.alerts')
      .listen('.task.sla.exceeded', (e) => {
        showAlert(
          `⚠️ SLA ALERT: Task "${e.task_name}" exceeded by ${e.exceeded_by_minutes} minutes`,
          e.alert_level
        );
        fetchSLAData();
      });

    return () => {
      clearInterval(interval);
      Echo.leave('admin.sla.alerts');
    };
  }, []);

  const fetchSLAData = async () => {
    const [statsRes, atRiskRes] = await Promise.all([
      axios.get('/api/backend/tasks/sla/statistics'),
      axios.get('/api/backend/tasks/sla/at-risk'),
    ]);
    
    setStats(statsRes.data.statistics);
    setAtRisk(atRiskRes.data.tasks_at_risk);
  };

  return (
    <div className="sla-dashboard">
      <div className="stats-grid">
        <StatCard title="On Time" value={stats?.on_time} color="green" />
        <StatCard title="At Risk" value={stats?.at_risk} color="orange" />
        <StatCard title="Exceeded" value={stats?.exceeded} color="red" />
        <StatCard 
          title="Compliance Rate" 
          value={`${stats?.compliance_rate}%`} 
          color={stats?.compliance_rate > 80 ? 'green' : 'red'}
        />
      </div>

      <div className="at-risk-tasks">
        <h3>Tasks At Risk</h3>
        {atRisk.map(task => (
          <TaskCard 
            key={task.task_id}
            task={task}
            riskLevel={task.risk_level}
          />
        ))}
      </div>
    </div>
  );
};
```

---

## 7. Configuration

### Broadcasting Configuration

**`.env`:**
```env
BROADCAST_DRIVER=pusher

PUSHER_APP_ID=your_app_id
PUSHER_APP_KEY=your_app_key
PUSHER_APP_SECRET=your_app_secret
PUSHER_APP_CLUSTER=eu
```

**Or use Laravel WebSockets (self-hosted):**
```bash
composer require beyondcode/laravel-websockets
php artisan websockets:serve
```

---

### Queue Configuration

**`.env`:**
```env
QUEUE_CONNECTION=redis
```

**Run queue worker:**
```bash
php artisan queue:work --queue=default,notifications
```

---

## 8. Testing

### Test Real-Time Updates

```bash
# Terminal 1: Start queue worker
php artisan queue:work

# Terminal 2: Start scheduler (or run command manually)
php artisan tasks:monitor-sla

# Terminal 3: Trigger task completion
curl -X POST http://localhost:8000/api/backend/adv/bc/114/approve
```

**Expected:**
1. `TaskStatusChanged` event broadcasted
2. Next task becomes ready
3. `TaskBecameReady` event broadcasted
4. User receives `TaskReadyNotification`
5. Frontend updates in real-time

---

### Test SLA Alerts

```bash
# Create a task with short timeout
# Wait for timeout to expire
# Run SLA monitor
php artisan tasks:monitor-sla
```

**Expected:**
1. `TaskSLAExceeded` event broadcasted
2. Users receive `TaskSLAExceededNotification`
3. Email sent to assigned users and admins
4. Alert appears in frontend

---

## 9. Production Deployment

### Checklist

- [ ] Configure broadcasting (Pusher or Laravel WebSockets)
- [ ] Set up queue workers with supervisor
- [ ] Schedule SLA monitoring command
- [ ] Configure notification channels (mail, database, broadcast)
- [ ] Set up Redis for queue and broadcasting
- [ ] Test WebSocket connections
- [ ] Monitor queue performance
- [ ] Set up logging for events and notifications

### Supervisor Configuration

**`/etc/supervisor/conf.d/laravel-worker.conf`:**
```ini
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/artisan queue:work --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=4
redirect_stderr=true
stdout_logfile=/path/to/storage/logs/worker.log
stopwaitsecs=3600
```

---

## 10. Benefits

### ✅ Real-Time Visibility
- Instant updates without polling
- Reduced server load
- Better user experience

### ✅ Proactive Alerts
- Users notified when tasks ready
- Admins alerted to SLA violations
- Prevents workflow bottlenecks

### ✅ SLA Compliance
- Track performance metrics
- Identify at-risk tasks early
- Improve workflow efficiency

### ✅ Scalable Architecture
- Queue-based processing
- Broadcasting infrastructure
- Production-ready

---

**Status:** ✅ **PRODUCTION READY**

All real-time features implemented with WebSocket broadcasting, task notifications, and comprehensive SLA tracking.
