"""Parse current and historical Python/TOML; never execute project source."""
import ast
import hashlib
import json
import pathlib
import subprocess
import sys
import tomllib
from datetime import datetime, timezone

folder = pathlib.Path('_artifacts/exhaustive-audit-20260831')
source = json.loads((folder / 'static-audit.json').read_text(encoding='utf-8'))
results = []
for kind in ('current', 'history'):
    for item in source[kind]:
        if item['status'] != 'unparsed' or pathlib.Path(item['path']).suffix not in ('.py', '.toml'):
            continue
        data = (pathlib.Path(item['path']).read_bytes() if kind == 'current' else
                subprocess.check_output(['git', 'cat-file', 'blob', item['blob']]))
        result = {'scope': kind, 'path': item['path'], 'blob': item.get('blob'),
                  'sha256': hashlib.sha256(data).hexdigest(), 'status': 'parsed'}
        try:
            text = data.decode('utf-8-sig')
            if item['path'].endswith('.py'):
                ast.parse(text, filename=item['path'])
                result['method'] = 'Python ast.parse, UTF-8-sig'
            else:
                tomllib.loads(text)
                result['method'] = 'Python tomllib, UTF-8-sig'
        except Exception as error:
            result.update(status='parse-failed', error=str(error))
        results.append(result)
report = {'at': datetime.now(timezone.utc).isoformat(), 'pythonVersion': sys.version, 'results': results}
(folder / 'language-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'files': len(results), 'failures': sum(r['status'] == 'parse-failed' for r in results)}))
