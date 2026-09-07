#!/usr/bin/env python3
"""Import source-scoped personal votes. Python 3 standard library only.

Historical XML contains both party-level candidate totals and ballot-list rows.
Read each once and reconcile them; never sum the two representations together.
"""
import collections
import csv
import hashlib
import gzip
import io
import json
import pathlib
import re
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from candidate_xlsx import xlsx_rows

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / 'data/raw/downloads/candidate-history'
MANIFEST = ROOT / 'data/raw/valmyndigheten/candidate-history-source-manifest.json'
manifest = json.loads(MANIFEST.read_text())
SOURCES = {s['file']: s for s in manifest['sources']}
PARTIES = {'0001': 'M', '0002': 'S', '0003': 'L', '0004': 'C', '0005': 'V', '0053': 'MP', '0077': 'KD', '0110': 'SD'}
ABBR = {v: k for k, v in PARTIES.items()} | {'FP': '0003'}
municipalities = {m['code']: m for m in json.loads((ROOT / 'data/normalized/local-election-index.json').read_text())['municipalities']}
counties = {m['code']: m['name'] for m in json.loads((ROOT / 'data/normalized/local-election-index.json').read_text())['counties']}
rd_names = {a['code']: a['name'] for a in json.loads((ROOT / 'data/normalized/personal-votes-2022.json').read_text())['constituencies']}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source(file):
    spec = SOURCES[file]
    path = RAW / file
    if not path.exists():
        RAW.mkdir(parents=True, exist_ok=True)
        request = urllib.request.Request(spec.get('archiveUrl', spec['url']), headers={'User-Agent': 'Politicalverse historical election importer'})
        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read()
        assert sha(data) == spec['sha256'], f'Changed source {file}'
        path.write_bytes(data)
    assert sha(path.read_bytes()) == spec['sha256'], f'Changed source {file}'
    return path


def count(value):
    assert re.fullmatch(r'\d+', value or ''), f'Invalid official count: {value!r}'
    return int(value)


def metadata_add(meta, id, name=None, age=None, municipality=None):
    row = meta.setdefault(id, {'names': set(), 'ages': set(), 'municipalities': set()})
    if name and name != 'Namnet gallrat':
        row['names'].add(name.strip())
    if age and re.fullmatch(r'\d+', age):
        row['ages'].add(int(age))
    if municipality in municipalities:
        row['municipalities'].add(municipality)


def load_metadata(year):
    meta = {}
    if year == 2010:
        rows = csv.reader(source('2010-person.skv').open(encoding='latin1'), delimiter=';')
        next(rows)
        for row in rows:
            metadata_add(meta, row[5], age=row[4])
    elif year == 2014:
        for typ, filename, id_col, age_col, name_col in [('R', '2014-candidates.skv', 7, 9, 8), ('L', '2014-candidates-L.skv', 9, 11, 10), ('K', '2014-candidates-K.skv', 11, 13, 12)]:
            for row in csv.reader(source(filename).open(encoding='latin1'), delimiter=';'):
                municipality = row[1].zfill(2) + row[3].zfill(2) if typ == 'K' else None
                metadata_add(meta, row[id_col], name=row[name_col], age=row[age_col], municipality=municipality)
    else:
        if year == 2018:
            stream = source('2018-candidates.skv').open(encoding='latin1')
        else:
            with zipfile.ZipFile(source('2022-candidates.zip')) as z:
                stream = io.StringIO(z.read('kandidaturer.csv').decode('utf-8-sig'), newline=None)
        rows = csv.reader(stream, delimiter=';')
        header = next(rows)
        assert header[15] == 'KANDIDATNUMMER' and header[17] == 'ÅLDER_PÅ_VALDAGEN'
        by_name = {m['name']: code for code, m in municipalities.items()}
        for row in rows:
            if not row[15].isdigit():
                continue
            municipality = row[1].zfill(4) if row[0] in ['K', 'KF'] else by_name.get(row[19])
            metadata_add(meta, row[15], name=row[16], age=row[17], municipality=municipality)
    return meta


def area_record(election, code, name, level, county, parent, year):
    superseded = 2011 if year == 2010 and (election == 'RF' and county == '14' or election == 'KF' and code in ['1880', '188004']) else 2015 if year == 2014 and election == 'KF' and code.startswith('1278') else 2019 if year == 2018 and election == 'KF' and code.startswith('2080') else None
    return {'electionType': election, 'code': code, 'name': name, 'level': level, 'county': county, 'parent': parent, 'supersededBy': superseded, 'partyVotes': {}, 'candidates': []}


def historical(year, meta):
    filename = f'results{year}' + ('.zip' if year == 2018 else '-archived.zip')
    areas = []
    anchors = {}
    with zipfile.ZipFile(source(filename)) as z:
        municipal_nation = ET.fromstring(z.read('slutresultat_00K.xml')).find('NATION')
        anchors['KF'] = {'validVotes': count(municipal_nation.attrib['RÖSTER']), 'personalVotes': count(municipal_nation.attrib['PERSONKRYSS'])}
        files = [('RD', 'slutresultat_00R.xml', 'KRETS_RIKSDAG'), ('RF', 'slutresultat_00L.xml', 'KRETS_LANDSTING')]
        files += [('KF', f'slutresultat_{code}K.xml', 'KRETS_KOMMUN') for code in municipalities]
        for election, name, tag in files:
            root = ET.fromstring(z.read(name))
            assert root.attrib['VALDAG'].startswith(str(year)), f'Wrong election in {name}'
            if election in ['RD', 'RF']:
                nation = root.find('NATION')
                anchors[election] = {'validVotes': count(nation.attrib['RÖSTER']), 'personalVotes': count(nation.attrib['PERSONKRYSS'])}
            for el in root.iter():
                if el.tag in ['VALD', 'ERSÄTTARE']:
                    metadata_add(meta, el.attrib.get('KANDNR'), name=el.attrib.get('NAMN'), age=el.attrib.get('ÅLDER'))
            units = list(root.iter(tag))
            # One-constituency municipal elections may expose candidates directly under KOMMUN.
            if election == 'KF' and not units:
                units = [root.find('KOMMUN')]
            for unit in units:
                raw_code = unit.attrib['KOD']
                code = raw_code[-2:] if election == 'RD' else raw_code if election == 'RF' or len(raw_code) == 6 else raw_code + '00'
                county = raw_code[:2]
                parent = code[:4] if election == 'KF' else county if election == 'RF' else None
                area = area_record(election, code, unit.attrib['NAMN'], 'constituency', county, parent, year)
                area['boundaryChanged'] = unit.attrib.get('INDELNING') == 'Modifierad'
                if election == 'RD':
                    area['members'] = sorted({m.attrib['KOD'] for m in unit.iter('KOMMUN')})
                for party in unit.findall('GILTIGA') + unit.findall('ÖVRIGA_GILTIGA/GILTIGA'):
                    lists = party.findall('VALSEDEL')
                    party_code = ABBR.get(party.attrib['PARTI']) or ((lists + party.findall('PARTISEDEL'))[0].attrib['LISTNUMMER'].split('-')[0] if lists or party.findall('PARTISEDEL') else party.attrib['PARTI'].zfill(4))
                    party_name = next(p.attrib['BETECKNING'] for p in root.findall('PARTI') if p.attrib['FÖRKORTNING'] == party.attrib['PARTI'])
                    votes = count(party.attrib['RÖSTER'])
                    area['partyVotes'][party_code] = votes
                    # A candidate number can have multiple name spellings on different
                    # lists (e.g. Clas/Claes Sundberg, RF 2303 in 2010). The
                    # official direct totals split those aliases. Group by the
                    # election-scoped number, retaining every source spelling.
                    direct = {}
                    for p in party.findall('PERSONVAL'):
                        id = p.attrib['KANDNR']
                        metadata_add(meta, id, name=p.attrib['NAMN'])
                        if id not in direct:
                            direct[id] = p.attrib.copy()
                        else:
                            direct[id]['PERSONKRYSS'] = str(count(direct[id].get('PERSONKRYSS', '0')) + count(p.attrib.get('PERSONKRYSS', '0')))
                    only_lists = set()
                    list_counts = collections.Counter()
                    list_votes = collections.Counter()
                    seen = set()
                    for ballot in lists:
                        for p in ballot.findall('PERSONVAL'):
                            id = p.attrib['KANDNR']
                            key = (ballot.attrib['LISTNUMMER'], p.attrib['KANDIDAT'])
                            assert key not in seen, f'Duplicate ballot position {key}'
                            seen.add(key)
                            list_counts[id] += 1
                            list_votes[id] += count(p.attrib.get('PERSONKRYSS', '0'))
                            if id not in direct:
                                direct[id] = p.attrib | {'PERSONKRYSS': '0'}
                                only_lists.add(id)
                    personal_total = 0
                    for id, p in direct.items():
                        n = list_votes[id] if id in only_lists else count(p.get('PERSONKRYSS', '0'))
                        if id in list_votes:
                            assert n == list_votes[id], f'Candidate/list disagreement {year}:{code}:{id}: {n} != {list_votes[id]}'
                        assert n <= votes
                        personal_total += n
                        metadata_add(meta, id, name=p['NAMN'], municipality=parent if election == 'KF' else None)
                        area['candidates'].append({'id': id, 'name': p['NAMN'], 'partyCode': party_code, 'partyId': PARTIES.get(party_code, 'OTHER'), 'partyName': party_name, 'votes': n, 'partyVotes': votes, 'lists': list_counts[id]})
                    if 'PERSONKRYSS' in party.attrib:
                        assert personal_total == count(party.attrib['PERSONKRYSS']), f'Party personal total {year}:{election}:{code}:{party_code}: {personal_total}/{party.attrib["PERSONKRYSS"]}'
                areas.append(area)
    return areas, anchors, [filename]


# Reviewed spelling difference between the two official 2022 workbooks.
PARTY_NAMES_2022 = {'SOS-Ställ Om Sverige, Söderhamnsinitiativet': 'SOS-Ställ Om Sverige  Söderhamnsinitiativet'}

def current(meta):
    area_map = {}
    names = {}
    members = collections.defaultdict(set)
    party_codes = {}
    denominators = collections.Counter()
    for election, file in [('RD', 'rd2022.xlsx'), ('RF', 'rf2022.xlsx'), ('KF', 'kf2022.xlsx')]:
        rows = xlsx_rows(source(file), 'roster_' + election)
        header = next(rows)
        assert header[7] == 'Valkretskod' and header[10] == 'Röster'
        for row in rows:
            assert row[0] == election
            code = row[7]
            members[(election, code)].add(row[5][:4])
            denominators[(election, code, row[9])] += count(row[10])
            if election != 'RD':
                names[(election, code)] = row[8] or (counties[code[:2]] if election == 'RF' else municipalities[code[:4]]['name'])
    rows = xlsx_rows(source('personal2022.xlsx'), 'Rådata')
    header = next(rows)
    assert header[:3] == ['Valtyp', 'Länskod', 'Län'] and header[18] == 'Antal personröster'
    seen = set()
    grouped = {}
    for row in rows:
        election = row[0]
        assert election in ['RD', 'RF', 'KF']
        code = row[6] if election == 'RD' else row[1] + row[6] if election == 'RF' else row[4] + row[6]
        key = (election, code)
        if key not in area_map:
            county = next(m['parent'] for m in municipalities.values() if code in m.get('constituencies', [])) if election == 'RD' else code[:2]
            area_map[key] = area_record(election, code, rd_names[code] if election == 'RD' else names[key], 'constituency', county, code[:4] if election == 'KF' else county if election == 'RF' else None, 2022)
        area = area_map[key]
        party_code, party_name, id = row[8], row[10], row[13]
        denominator_name = PARTY_NAMES_2022.get(party_name, party_name)
        party_scope = (election, code[:4] if election == 'KF' else code[:2] if election == 'RF' else '00', denominator_name)
        assert party_scope not in party_codes or party_codes[party_scope] == party_code, (party_scope, party_code, party_codes.get(party_scope))
        party_codes[party_scope] = party_code
        candidate_key = (election, code, party_code, id)
        row_key = candidate_key + (row[11], row[12])
        assert row_key not in seen
        seen.add(row_key)
        votes = count(row[18])
        party_votes = denominators[(election, code, denominator_name)]
        assert not votes or party_votes > 0, f'Missing denominator {candidate_key}'
        area['partyVotes'][party_code] = party_votes
        c = grouped.setdefault(candidate_key, {'id': id, 'name': row[16], 'partyCode': party_code, 'partyId': PARTIES.get(party_code, 'OTHER'), 'partyName': party_name, 'votes': 0, 'partyVotes': party_votes, 'lists': 0})
        assert c['name'] == row[16]
        c['votes'] += votes
        c['lists'] += 1
        metadata_add(meta, id, name=row[16], municipality=code[:4] if election == 'KF' else None)
    for (election, code, _, _), candidate in grouped.items():
        assert candidate['votes'] <= candidate['partyVotes']
        area_map[(election, code)]['candidates'].append(candidate)
    for key, area in area_map.items():
        area['members'] = sorted(members[key])
    for (election, code, party_name), votes in denominators.items():
        party_scope = (election, code[:4] if election == 'KF' else code[:2] if election == 'RF' else '00', party_name)
        if (election, code) in area_map and party_scope in party_codes:
            area_map[(election, code)]['partyVotes'][party_codes[party_scope]] = votes
    # Pinned sums of the full official 2022 personal-vote workbook.
    personal_totals = {'RD': 1457836, 'RF': 1304159, 'KF': 1656282}
    anchors = {e: {'validVotes': sum(n for (typ, _, name), n in denominators.items() if typ == e and name == 'Summa giltiga röster'), 'personalVotes': personal_totals[e]} for e in personal_totals}
    return list(area_map.values()), anchors, ['personal2022.xlsx', 'rd2022.xlsx', 'rf2022.xlsx', 'kf2022.xlsx']


def aggregate_areas(areas, year):
    aggregates = {}
    for area in areas:
        if area['electionType'] == 'RD':
            continue
        key = (area['electionType'], area['parent'])
        if key not in aggregates:
            name = municipalities[key[1]]['name'] if key[0] == 'KF' else counties[key[1]]
            aggregates[key] = area_record(key[0], key[1], name, 'municipality' if key[0] == 'KF' else 'region', area['county'], None, year)
        aggregate = aggregates[key]
        for party, votes in area['partyVotes'].items():
            aggregate['partyVotes'][party] = aggregate['partyVotes'].get(party, 0) + votes
        for c in area['candidates']:
            same = next((p for p in aggregate['candidates'] if p['id'] == c['id'] and p['partyCode'] == c['partyCode']), None)
            if same is None:
                aggregate['candidates'].append(c.copy())
            else:
                same['votes'] += c['votes']
                same['lists'] += c['lists']
    for area in aggregates.values():
        for c in area['candidates']:
            c['partyVotes'] = area['partyVotes'][c['partyCode']]
    return areas + list(aggregates.values())


def run():
    for year in [2010, 2014, 2018, 2022]:
        print(f'Importing {year}...', flush=True)
        meta = load_metadata(year)
        areas, anchors, files = current(meta) if year == 2022 else historical(year, meta)
        for election, anchor in anchors.items():
            total = sum(c['votes'] for a in areas if a['electionType'] == election for c in a['candidates'])
            assert total == anchor['personalVotes'], f'National personal totals {year}:{election} {total}/{anchor}'
        areas = aggregate_areas(areas, year)
        for area in areas:
            area['candidates'].sort(key=lambda c: (-c['votes'], c['name'], c['id'], c['partyCode']))
            sums = collections.Counter()
            for c in area['candidates']:
                sums[c['partyCode']] += c['votes']
            assert all(sums[p] <= votes for p, votes in area['partyVotes'].items())
        areas.sort(key=lambda a: (a['electionType'], a['code']))
        used_ids = {c['id'] for a in areas for c in a['candidates']}
        meta = {id: {key: sorted(value) for key, value in m.items()} for id, m in sorted(meta.items()) if id in used_ids}
        out = {'schemaVersion': 1, 'year': year, 'classification': 'OFFICIAL', 'status': 'final', 'methodVersion': manifest['methodVersion'], 'sourceFiles': files, 'anchors': anchors, 'areas': areas, 'identities': meta}
        path = f'data/normalized/candidate-elections-{year}.json.gz'
        data = (json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        # GzipFile fixes the OS header too; gzip.compress(..., mtime=0) in
        # Python 3.11/3.12 delegates that byte to the platform's zlib.
        compressed = io.BytesIO()
        with gzip.GzipFile(fileobj=compressed, mode='wb', filename='', mtime=0) as stream:
            stream.write(data)
        data = compressed.getvalue()
        if path in manifest['outputs']:
            assert sha(data) == manifest['outputs'][path], f'Output changed {path}; review before accepting'
        (ROOT / path).write_bytes(data)
        manifest['outputs'][path] = sha(data)
        print(year, len(areas), 'areas;', len(meta), 'election identities;', len(data), 'bytes;', anchors, flush=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    run()
