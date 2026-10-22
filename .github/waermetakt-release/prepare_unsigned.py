"""Remove only Expo's known disposable debug identity from the generated release build.

Fail closed for a changed template or existing production signer. Debug builds and
all product configuration stay byte-for-byte intact. Central signing happens later.
"""
import pathlib,re,sys

def prepare(source):
 blocks=list(re.finditer(r'^ {8}release \{\n(.*?)^ {8}\}',source,re.M|re.S))
 if len(blocks)!=1:raise ValueError('Expected one known generated release block')
 block=blocks[0];body=block.group(1)
 lines=re.findall(r'^\s*signingConfig\s+(.+?)\s*$',body,re.M)
 if lines==['null']:return source
 if lines!=['signingConfigs.debug']:raise ValueError('Unknown or ambiguous release identity; no change')
 updated,n=re.subn(r'^ {12}signingConfig signingConfigs\.debug$', '            signingConfig null',body,flags=re.M)
 if n!=1:raise ValueError('Unknown generated signing line; no change')
 return source[:block.start(1)]+updated+source[block.end(1):]

if __name__=='__main__':
 path=pathlib.Path(sys.argv[1]);source=path.read_text();updated=prepare(source)
 if source!=updated:path.write_text(updated)
 print('Generated release is unsigned; debug build unchanged')
