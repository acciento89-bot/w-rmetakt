"""A download recovery may change delivery helpers, never the shipped product source."""
import pathlib,re,subprocess
PRODUCT_PATHS=['App.tsx','app.json','package.json','package-lock.json','src','assets','plugins','babel.config.js','metro.config.js','tsconfig.json','eas.json']
def assert_same_product(root:pathlib.Path,old:str,new:str):
 assert re.fullmatch('[0-9a-f]{40}',old)and re.fullmatch('[0-9a-f]{40}',new),'Exact commit IDs required'
 assert subprocess.run(['git','-C',str(root),'merge-base','--is-ancestor',old,new],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0,'Candidate source must be an ancestor'
 assert subprocess.run(['git','-C',str(root),'diff','--quiet',old,new,'--',*PRODUCT_PATHS],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0,'Product source changed'
