# Setting Up Automatic Tally Sync via Windows Task Scheduler

This guide provides step-by-step instructions for scheduling the VChemics Standalone Sync Agent (`run-sync.bat`) to run automatically every 15 minutes on the VChemics PC.

---

## Prerequisites

1. **TallyPrime 7.0** must be running with ODBC / XML Server enabled on port `9000`.
2. **Node.js (v18+)** must be installed and added to your system `PATH`.
3. The standalone agent must be installed in `C:\VChemicsSyncAgent` (or your preferred folder) with `.env` configured:
   ```env
   TALLY_URL=http://localhost:9000
   BACKEND_URL=https://your-dashboard-backend.com
   SYNC_AGENT_TOKEN=your-sync-agent-token-here
   COMPANY_NAME=VCHEMICS INDIA SOLUTIONS-2026-2027
   FY_START=20260401
   ```

---

## Step 1: Open Windows Task Scheduler

1. Press `Win + R` on your keyboard to open the **Run** dialog.
2. Type `taskschd.msc` and press **Enter**.
3. In the Task Scheduler window, click **Task Scheduler Library** in the left sidebar.
4. On the right panel (**Actions**), click **Create Task...** (do NOT choose "Create Basic Task").

---

## Step 2: Configure General Tab

In the **General** tab of the Create Task window:

1. **Name**: `VChemics Tally Auto Sync`
2. **Description**: `Automated 15-minute background sync of TallyPrime vouchers, inventory, bills, P&L, and balance sheet to VChemics CEO Dashboard.`
3. Select **Run whether user is logged on or not**.
4. Check **Run with highest privileges**.
5. **Configure for**: `Windows 10` or `Windows 11`.

---

## Step 3: Configure Triggers Tab (Every 15 Minutes)

1. Switch to the **Triggers** tab and click **New...**.
2. **Begin the task**: `At log on` or `At startup`.
3. Under **Advanced settings**:
   - Check **Repeat task every**: Select `15 minutes`.
   - **For a duration of**: Select `Indefinitely`.
   - Check **Enabled**.
4. Click **OK**.

---

## Step 4: Configure Actions Tab

1. Switch to the **Actions** tab and click **New...**.
2. **Action**: `Start a program`.
3. **Program/script**: Browse and select `run-sync.bat` (e.g., `C:\VChemicsSyncAgent\run-sync.bat`).
4. **Start in (optional)**: Enter the folder path without quotes (e.g., `C:\VChemicsSyncAgent`).
5. Click **OK**.

---

## Step 5: Configure Settings Tab

1. Switch to the **Settings** tab.
2. Check **Allow task to be run on demand**.
3. Check **Run task as soon as possible after a scheduled start is missed**.
4. Check **If the task fails, restart every**: `1 minute`, **Attempt to restart up to**: `3 times`.
5. Under **If the running task does not end when requested, force it to stop**: Checked.
6. Under **If the task is already running, the following rule applies**: `Do not start a new instance`.
7. Click **OK**. You may be prompted for your Windows Administrator password.

---

## Step 6: Verify Operation

1. Right-click the newly created **VChemics Tally Auto Sync** task in Task Scheduler.
2. Click **Run**.
3. Open `sync.log` inside `C:\VChemicsSyncAgent` to verify execution:
   ```text
   VChemics Consolidated Standalone Sync Agent
   -------------------------------------------
   Tally URL : http://localhost:9000
   Backend   : https://your-dashboard-backend.com
   Company   : VCHEMICS INDIA SOLUTIONS-2026-2027

   [day-book] -> day-book: pushed 45 record(s)
   ...
   Sync complete: 45 vouchers, 62 items, 18 bills, KPIs updated
   ```

---

## Troubleshooting

- **Exit code 1**: Check `sync.log` for error messages. Ensure TallyPrime is open and backend URL is reachable.
- **Node command not found**: Specify absolute node path in `run-sync.bat` (e.g., `"C:\Program Files\nodejs\node.exe" sync-once.js >> sync.log 2>&1`).
