# Calm Cockpit - Cloud Deployment Guide

The easiest and most reliable free host for a Python/Flask app that uses an **SQLite database** is **PythonAnywhere**. Other free hosts (like Render or Heroku) delete your SQLite database every time they restart, which would wipe all your attendance and finance data. PythonAnywhere gives you persistent storage.

## Step 1: Prepare your Codebase
Before deploying, you need to tell the cloud server what Python packages your app uses.
1. Open your terminal in the `calm_cockpit` folder on your laptop.
2. Run this command to generate a list of your installed packages:
   ```cmd
   pip freeze > requirements.txt
   ```
3. Make sure your `run.py` file is at the root of the folder.

## Step 2: Push to GitHub (Recommended)
The best way to get your code onto the cloud server is through a private GitHub repository.
1. Create a new private repository on GitHub.
2. Commit and push your `calm_cockpit` folder to that repository.
*(You can manually upload a `.zip` file of your code to PythonAnywhere later, but GitHub is much easier for pushing updates).*

## Step 3: Set up PythonAnywhere
1. Go to [PythonAnywhere.com](https://www.pythonanywhere.com/) and create a free "Beginner" account. Your username will be your website link (e.g., `username.pythonanywhere.com`).
2. Log in and go to the **Consoles** tab.
3. Start a new **Bash** console.

## Step 4: Download your Code to the Server
In the Bash console, download your code:
* **If you used GitHub:** Run `git clone https://github.com/your-username/your-repo-name.git`
* **If you didn't:** Go to the "Files" tab, click "Upload a file", upload a ZIP of your code, then in the Bash console run `unzip your-file.zip`.

## Step 5: Install Dependencies
Still in the Bash console, set up a virtual environment and install your packages:
```bash
# Create a virtual environment
mkvirtualenv myenv --python=python3.10

# Go into your project folder
cd calm_cockpit

# Install packages
pip install -r requirements.txt
```

## Step 6: Configure the Web App
1. Go to the **Web** tab at the top of PythonAnywhere and click **Add a new web app**.
2. Click Next, select **Manual Configuration** (do *not* select Flask, choose Manual), and pick Python 3.10.
3. Scroll down to the **Virtualenv** section, and enter exactly this: `myenv`. Click the checkmark.
4. Scroll to the **Code** section. 
   - Set **Source Code** to `/home/yourusername/calm_cockpit`
   - Click the link next to **WSGI configuration file**. It will open a text editor.

## Step 7: Edit the WSGI File
Delete everything in the WSGI file and paste this exact code (replacing `yourusername` with your actual username):
```python
import sys
import os

# Add your project folder to the system path
path = '/home/yourusername/calm_cockpit'
if path not in sys.path:
    sys.path.append(path)

# Import your Flask app
from run import app as application
```
Save the file and go back to the Web tab.

## Step 8: Initialize Your Database & Launch
1. Go back to your Bash console (or open a new one in the virtual environment).
2. Run your init database command to create the tables. Ensure you are in the `/home/yourusername/calm_cockpit` folder:
   ```bash
   flask init-db
   ```
3. Go back to the **Web** tab and click the big green **Reload** button at the top.

That's it! Visit `https://yourusername.pythonanywhere.com` on your phone. To update your code later, just push to GitHub, run `git pull` in the PythonAnywhere console, and click the "Reload" button in the Web tab.
