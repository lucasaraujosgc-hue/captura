import os
import time
import sqlite3
import requests
import json
import logging
import xml.etree.ElementTree as ET
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

logging.basicConfig(
    filename="agente.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ImportError:
    tk = None

# ==========================================
# CONSTANTES
# ==========================================
BANCO_LOCAL = "controle_xml.db"
CONFIG_FILE = "config.json"
NS = {'ns': 'http://www.portalfiscal.inf.br/nfe'}

def load_config():
    if not os.path.exists(CONFIG_FILE):
        return None
    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=4)

# ==========================================
# CONFIGURADOR VISUAL (TKINTER)
# ==========================================
def run_configurator():
    if not tk:
        print("Interface gráfica não disponível. Crie o config.json manualmente.")
        return None

    root = tk.Tk()
    root.title("NFe Automator - Configuração Inicial")
    root.geometry("600x500")

    config_data = {
        "api_url": "https://nfe.virgulacontabil.com.br/api/upload",
        "api_token": "",
        "monitoramentos": []
    }

    # API
    tk.Label(root, text="URL do Servidor (API):", font=("Arial", 10, "bold")).pack(pady=(10, 0), anchor="w", padx=20)
    ent_url = tk.Entry(root, width=80)
    ent_url.insert(0, config_data["api_url"])
    ent_url.pack(padx=20)

    tk.Label(root, text="Token da Empresa (Gerado no site):", font=("Arial", 10, "bold")).pack(pady=(10, 0), anchor="w", padx=20)
    ent_token = tk.Entry(root, width=80)
    ent_token.pack(padx=20)

    tk.Label(root, text="Pastas Monitoradas:", font=("Arial", 10, "bold")).pack(pady=(10, 0), anchor="w", padx=20)
    
    frame_pastas = tk.Frame(root)
    frame_pastas.pack(fill="x", padx=20, pady=5)
    
    tree = ttk.Treeview(frame_pastas, columns=("Tipo", "Modalidade", "Mapeamento"), show="headings", height=5)
    tree.heading("Tipo", text="Entrada/Saída")
    tree.heading("Modalidade", text="Modelo (55/65)")
    tree.heading("Mapeamento", text="Pasta")
    tree.pack(fill="x")

    def add_pasta():
        folder = filedialog.askdirectory(title="Selecione a pasta")
        if not folder: return
        
        win_det = tk.Toplevel(root)
        win_det.title("Detalhes da Pasta")
        
        tk.Label(win_det, text="Tipo de Nota:").pack()
        cb_tipo = ttk.Combobox(win_det, values=["Entrada", "Saida", "Cancelada", "Inutilizada"])
        cb_tipo.current(0)
        cb_tipo.pack()
        
        tk.Label(win_det, text="Modalidade:").pack()
        cb_mod = ttk.Combobox(win_det, values=["55 (NFe)", "65 (NFCe)"])
        cb_mod.current(0)
        cb_mod.pack()
        
        def save_pasta():
            tree.insert("", "end", values=(cb_tipo.get(), cb_mod.get()[:2], folder))
            config_data["monitoramentos"].append({
                "pasta": folder,
                "tipo": cb_tipo.get(),
                "modelo_esperado": cb_mod.get()[:2]
            })
            win_det.destroy()
            
        tk.Button(win_det, text="Salvar Pasta", command=save_pasta).pack(pady=10)

    btn_add = tk.Button(root, text="Adicionar Pasta ao Monitoramento+", command=add_pasta)
    btn_add.pack(pady=5)

    def concluir():
        token = ent_token.get().strip()
        url = ent_url.get().strip()
        if not token or not url:
            messagebox.showerror("Erro", "Token e URL são obrigatórios.")
            return
        if not config_data["monitoramentos"]:
            messagebox.showerror("Erro", "Adicione pelo menos uma pasta para monitorar.")
            return
        
        config_data["api_token"] = token
        config_data["api_url"] = url
        save_config(config_data)
        messagebox.showinfo("Sucesso", "Configuração salva com sucesso! O Agente será iniciado.")
        root.destroy()

    tk.Button(root, text="Salvar e Iniciar", command=concluir, bg="green", fg="white", font=("Arial", 12, "bold")).pack(pady=20)
    root.mainloop()

    return load_config()

# ==========================================
# AGENTE
# ==========================================
def init_db():
    conn = sqlite3.connect(BANCO_LOCAL)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS xml_processados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chave_nfe TEXT UNIQUE,
            caminho_arquivo TEXT,
            data_processamento DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def is_processado(chave_nfe):
    conn = sqlite3.connect(BANCO_LOCAL)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM xml_processados WHERE chave_nfe = ?", (chave_nfe,))
    result = cursor.fetchone()
    conn.close()
    return result is not None

def registrar_processado(chave_nfe, caminho_arquivo):
    conn = sqlite3.connect(BANCO_LOCAL)
    cursor = conn.cursor()
    cursor.execute("INSERT OR IGNORE INTO xml_processados (chave_nfe, caminho_arquivo) VALUES (?, ?)", (chave_nfe, caminho_arquivo))
    conn.commit()
    conn.close()

def aguardar_arquivo_pronto(filepath, timeout=10):
    start_time = time.time()
    last_size = -1
    while time.time() - start_time < timeout:
        try:
            current_size = os.path.getsize(filepath)
            if current_size == last_size and current_size > 0:
                return True
            last_size = current_size
            time.sleep(1)
        except OSError:
            time.sleep(1)
    return False

def processar_xml(filepath, config, monitoramento):
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()

        infNFe = root.find('.//ns:infNFe', NS)
        if infNFe is None: return None

        chave_nfe = infNFe.attrib.get('Id', '').replace('NFe', '')
        if not chave_nfe: return None

        if is_processado(chave_nfe):
            logging.info(f"Pulo: Chave {chave_nfe} já enviada.")
            return True

        ide = infNFe.find('ns:ide', NS)
        modelo = ide.find('ns:mod', NS).text if ide is not None else ""
        data_emissao = ide.find('ns:dhEmi', NS).text if (ide is not None and ide.find('ns:dhEmi', NS) is not None) else (ide.find('ns:dEmi', NS).text if ide is not None and ide.find('ns:dEmi', NS) is not None else "")

        emit = infNFe.find('ns:emit', NS)
        cnpj_fornecedor = emit.find('ns:CNPJ', NS).text if (emit is not None and emit.find('ns:CNPJ', NS) is not None) else (emit.find('ns:CPF', NS).text if emit is not None and emit.find('ns:CPF', NS) is not None else "")
        nome_fornecedor = emit.find('ns:xNome', NS).text if emit is not None else ""

        dest = infNFe.find('ns:dest', NS)
        cnpj_destinatario = dest.find('ns:CNPJ', NS).text if (dest is not None and dest.find('ns:CNPJ', NS) is not None) else ""
        nome_destinatario = dest.find('ns:xNome', NS).text if (dest is not None and dest.find('ns:xNome', NS) is not None) else ""

        total = infNFe.find('.//ns:total/ns:ICMSTot/ns:vNF', NS)
        valor_total = total.text if total is not None else "0.00"

        # status and tipo from the folder configuration
        status = monitoramento.get("tipo", "Autorizada")
        tipo = "Entrada" if status == "Entrada" else ("Saida" if status == "Saida" else "Outro")

        payload = {
            "chave_nfe": chave_nfe,
            "modelo": modelo,
            "data_emissao": data_emissao,
            "cnpj_fornecedor": cnpj_fornecedor,
            "nome_fornecedor": nome_fornecedor,
            "cnpj_destinatario": cnpj_destinatario,
            "nome_destinatario": nome_destinatario,
            "valor_total": valor_total,
            "tipo": tipo,
            "status": status,
            "hostname": os.environ.get("COMPUTERNAME", "Desconhecido")
        }

        headers = {"Authorization": f"Bearer {config['api_token']}"}

        with open(filepath, 'rb') as f:
            files = {'file': (os.path.basename(filepath), f, 'application/xml')}
            response = requests.post(config['api_url'], headers=headers, data=payload, files=files)

        if response.status_code in [201, 200, 409]:
            registrar_processado(chave_nfe, filepath)
            logging.info(f"Sucesso: NFe {chave_nfe} enviada com sucesso.")
            return True
        else:
            logging.error(f"Erro servidor ({response.status_code}): {response.text}")
            return False

    except Exception as e:
        logging.error(f"Falha ao processar {filepath}: {e}")
        return False

class XMLHandler(FileSystemEventHandler):
    def __init__(self, config, monitoramento):
        self.config = config
        self.monitoramento = monitoramento

    def on_created(self, event):
        if not event.is_directory and event.src_path.lower().endswith('.xml'):
            logging.info(f"Novo XML detectado na pasta {self.monitoramento['pasta']}")
            if aguardar_arquivo_pronto(event.src_path):
                processar_xml(event.src_path, self.config, self.monitoramento)

def iniciar_monitoramento():
    config = load_config()
    if not config:
        config = run_configurator()
        if not config:
            return

    init_db()
    observer = Observer()

    for mon in config.get("monitoramentos", []):
        pasta = mon["pasta"]
        if not os.path.exists(pasta):
            logging.warning(f"Aviso: {pasta} não existe. Criando...")
            os.makedirs(pasta, exist_ok=True)
            
        logging.info(f"Inspecionando {pasta}...")
        for root, dirs, files in os.walk(pasta):
            for file in files:
                if file.lower().endswith('.xml'):
                    processar_xml(os.path.join(root, file), config, mon)

        event_handler = XMLHandler(config, mon)
        observer.schedule(event_handler, pasta, recursive=True)

    observer.start()
    logging.info(f"Agente Multi-Pastas inciado com sucesso.")

    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    iniciar_monitoramento()