import zipfile,xml.etree.ElementTree as E,posixpath
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
def xlsx_rows(path, sheet):
 with zipfile.ZipFile(path) as z:
  ss=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   for _,e in E.iterparse(z.open('xl/sharedStrings.xml'),events=['end']):
    if e.tag==NS+'si':ss.append(''.join(t.text or '' for t in e.iter(NS+'t')));e.clear()
  rel={e.attrib['Id']:e.attrib['Target'] for e in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  sheets={e.attrib['name']:rel[e.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']] for e in E.fromstring(z.read('xl/workbook.xml')).iter(NS+'sheet')}
  target=sheets[sheet];target=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
  for _,e in E.iterparse(z.open(target),events=['end']):
   if e.tag!=NS+'row':continue
   values={}
   for c in e:
    col=0
    for a in c.attrib['r']:
     if a.isalpha():col=col*26+ord(a)-64
     else:break
    value=c.findtext(NS+'v','')
    if c.attrib.get('t')=='s':value=ss[int(value)]
    if c.attrib.get('t')=='inlineStr':value=''.join(t.text or '' for t in c.iter(NS+'t'))
    values[col]=value.strip()
   yield [values.get(i,'') for i in range(1,max(values,default=0)+1)]
   e.clear()
