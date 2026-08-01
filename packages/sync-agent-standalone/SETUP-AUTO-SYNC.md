# VChemics Tally Auto-Sync Task Scheduler Instructions

Follow these steps to schedule automatic 15-minute Tally data synchronization on the **Vchemics PC**.

---

### Step 1: Open Task Scheduler
1. Press `Win + R` on your keyboard.
2. Type `taskschd.msc` and press **Enter**.

---

### Step 2: Create a New Task
1. In the right-hand panel, click **Create Basic Task...**
2. **Name**: `VChemics Tally Sync`
3. **Description**: `Syncs TallyPrime P&L, Balance Sheet, Stock Summary, and Outstandings every 15 minutes.`
4. Click **Next**.

---

### Step 3: Set Trigger Schedule
1. Select **Daily** and click **Next**.
2. Set the start date/time (default is fine) and click **Next**.

---

### Step 4: Configure Recurring Execution (15 Minutes)
1. Select **Start a program** and click **Next**.
2. **Program/script**: `C:\Users\vchem\OneDrive\Desktop\sync-agent-standalone\run-sync.bat`
3. **Start in (optional)**: `C:\Users\vchem\OneDrive\Desktop\sync-agent-standalone`
4. Click **Next**, then check **Open the Properties dialog for this task when I click Finish**, and click **Finish**.

---

### Step 5: Configure 15-Minute Repetition & Highest Privileges
1. In the task properties window, go to the **Triggers** tab.
2. Select the **Daily** trigger and click **Edit...**
3. Under **Advanced settings**:
   - Check **Repeat task every**: Select **`15 minutes`**
   - **For a duration of**: Select **`Indefinitely`**
4. Click **OK**.
5. In the **General** tab, check **Run with highest privileges**.
6. Click **OK** to save the task.

---

### Verification
1. In Task Scheduler, right-click **VChemics Tally Sync** and click **Run**.
2. Open `C:\Users\vchem\OneDrive\Desktop\sync-agent-standalone\sync.log` to confirm execution logs.
