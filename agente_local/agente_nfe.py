import os
import time
import sqlite3
import requests
import xml.etree.ElementTree as ET
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ==========================================
# CONFIGURAÇÕES DO AGENTE LOCAL
# ==========================================
API_URL = "http://localhost:3000/api/upload" # Altere para o IP/URL do seu VPS em produção
API_TOKEN = "chave-secreta-vps-123"
PASTA_MONITORADA = r"C:\Caminho\Para\XMLs" # Altere para a pasta raiz dos seus XMLs
BANCO_LOCAL = "controle_xml.db"

# Namespaces do XML da NFe
NS = {'ns': 'http://www.portalfiscal.inf.br/nfe'}

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

def processar_xml(filepath):
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()

        # Verifica se é procNFe ou procNFCe
        infNFe = root.find('.//ns:infNFe', NS)
        if infNFe is None:
            return None # Não é um XML de NFe/NFCe válido

        # Busca dados chave
        chave_nfe = infNFe.attrib.get('Id', '').replace('NFe', '')
        if not chave_nfe:
            return None

        if is_processado(chave_nfe):
            print(f"[{time.strftime('%H:%M:%S')}] Pulo: Chave {chave_nfe} já enviada.")
            return True

        # Extrair dados principais
        ide = infNFe.find('ns:ide', NS)
        modelo = ide.find('ns:mod', NS).text if ide is not None else ""
        data_emissao = ide.find('ns:dhEmi', NS).text if (ide is not None and ide.find('ns:dhEmi', NS) is not None) else (ide.find('ns:dEmi', NS).text if ide is not None and ide.find('ns:dEmi', NS) is not None else "")

        emit = infNFe.find('ns:emit', NS)
        cnpj_fornecedor = emit.find('ns:CNPJ', NS).text if (emit is not None and emit.find('ns:CNPJ', NS) is not None) else (emit.find('ns:CPF', NS).text if emit is not None and emit.find('ns:CPF', NS) is not None else "")
        nome_fornecedor = emit.find('ns:xNome', NS).text if emit is not None else ""

        dest = infNFe.find('ns:dest', NS)
        cnpj_destinatario = ""
        nome_destinatario = ""
        if dest is not None:
            if dest.find('ns:CNPJ', NS) is not None:
                cnpj_destinatario = dest.find('ns:CNPJ', NS).text
            elif dest.find('ns:CPF', NS) is not None:
                cnpj_destinatario = dest.find('ns:CPF', NS).text
            nome_destinatario = dest.find('ns:xNome', NS).text if dest.find('ns:xNome', NS) is not None else ""

        total = infNFe.find('.//ns:total/ns:ICMSTot/ns:vNF', NS)
        valor_total = total.text if total is not None else "0.00"

        # Validando se pertence ao modelo 55 ou 65
        if modelo not in ['55', '65']:
            return True # Ignorar sem dar erro

        payload = {
            "chave_nfe": chave_nfe,
            "modelo": modelo,
            "data_emissao": data_emissao,
            "cnpj_fornecedor": cnpj_fornecedor,
            "nome_fornecedor": nome_fornecedor,
            "cnpj_destinatario": cnpj_destinatario,
            "nome_destinatario": nome_destinatario,
            "valor_total": valor_total
        }

        # Enviar para a API
        headers = {
            "Authorization": f"Bearer {API_TOKEN}"
        }

        with open(filepath, 'rb') as f:
            files = {'file': (os.path.basename(filepath), f, 'application/xml')}
            response = requests.post(API_URL, headers=headers, data=payload, files=files)

        if response.status_code in [201, 200, 409]: # Se já existe (409) ou criou (201/200), registramos como OK
            registrar_processado(chave_nfe, filepath)
            print(f"[{time.strftime('%H:%M:%S')}] Sucesso: NFe {chave_nfe} enviada com sucesso.")
            return True
        else:
            print(f"[{time.strftime('%H:%M:%S')}] Erro servidor ({response.status_code}): {response.text}")
            return False

    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] Falha ao processar {filepath}: {e}")
        return False

class XMLHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory and event.src_path.lower().endswith('.xml'):
            print(f"[{time.strftime('%H:%M:%S')}] Novo XML detectado: {event.src_path}")
            if aguardar_arquivo_pronto(event.src_path):
                processar_xml(event.src_path)

def iniciar_monitoramento():
    if not os.path.exists(PASTA_MONITORADA):
        print(f"Aviso: A pasta {PASTA_MONITORADA} não existe. Criando...")
        os.makedirs(PASTA_MONITORADA, exist_ok=True)

    init_db()

    # Processar antigos que possam ter ficado pra trás
    print("Inspecionando arquivos já existentes na pasta...")
    for root, dirs, files in os.walk(PASTA_MONITORADA):
        for file in files:
            if file.lower().endswith('.xml'):
                processar_xml(os.path.join(root, file))

    event_handler = XMLHandler()
    observer = Observer()
    observer.schedule(event_handler, PASTA_MONITORADA, recursive=True)
    observer.start()

    print(f"\\n[{time.strftime('%H:%M:%S')}] Agente NFe Automator iniciado.")
    print(f"Monitorando (Recursivamente): {PASTA_MONITORADA}\\n")

    try:
        while True:
            time.sleep(5)
    except KeyboardInterrupt:
        observer.stop()
        print("Monitoramento encerrado pelo usuário.")
    
    observer.join()

if __name__ == "__main__":
    iniciar_monitoramento()
