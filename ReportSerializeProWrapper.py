import os
import sys
import psutil
import subprocess
import time
import urllib.request
import webview
import socket

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def kill_port_owner(port):
    for conn in psutil.net_connections():
        if conn.laddr.port == port:
            try:
                proc = psutil.Process(conn.pid)
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                pass

def kill_process_tree(pid):
    try:
        parent = psutil.Process(pid)
        children = parent.children(recursive=True)
        for child in children:
            child.terminate()
        psutil.wait_procs(children, timeout=3)
        parent.terminate()
        parent.wait(timeout=3)
    except Exception:
        pass

def main():
    # Detect the correct working directory, handling PyInstaller's Temp dir
    if getattr(sys, 'frozen', False):
        base_dir = os.path.dirname(sys.executable)
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
    
    os.chdir(base_dir)

    # Ensure Vite port is clear
    kill_port_owner(3001)

    # Check for node_modules
    node_modules_dir = os.path.join(base_dir, 'node_modules')
    if not os.path.exists(node_modules_dir):
        subprocess.run(["npm", "install"], shell=True, creationflags=subprocess.CREATE_NO_WINDOW)

    # Start the Vite server
    vite_proc = subprocess.Popen(["cmd.exe", "/c", "npm run dev"], shell=False, creationflags=subprocess.CREATE_NO_WINDOW)

    # Wait until Vite says it's ready
    is_up = False
    for _ in range(30):
        try:
            req = urllib.request.Request("http://127.0.0.1:3001", method="HEAD")
            urllib.request.urlopen(req, timeout=1)
            is_up = True
            break
        except Exception:
            time.sleep(1)

    if is_up:
        # Launch native chromeless WebView2!
        window = webview.create_window(
            'ReportSerialize Pro (深度报告连载神器)', 
            'http://127.0.0.1:3001/', 
            width=1280, 
            height=800,
            text_select=True,
            zoomable=True
        )
        webview.start(private_mode=False)

    # Clean up the dev server on exit
    kill_process_tree(vite_proc.pid)

if __name__ == '__main__':
    main()
