import { jest } from '@jest/globals';
import { getAllChallenges } from '../../src/challenges/index.js';
import { runTests, runQualitativeChecks } from '../../src/engine/tester.js';

// Known-good solutions for each challenge
const solutions = {
  'fizzbuzz': `def fizzbuzz(n):
    return ['FizzBuzz' if i%15==0 else 'Fizz' if i%3==0 else 'Buzz' if i%5==0 else str(i) for i in range(1, n+1)]`,

  'binary-search': `def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target: return mid
        elif arr[mid] < target: lo = mid + 1
        else: hi = mid - 1
    return -1`,

  'lru-cache': `from collections import OrderedDict
class LRUCache:
    def __init__(self, capacity):
        self.cap = capacity
        self.cache = OrderedDict()
    def get(self, key):
        if key not in self.cache: return -1
        self.cache.move_to_end(key)
        return self.cache[key]
    def put(self, key, value):
        if key in self.cache: self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.cap: self.cache.popitem(last=False)`,

  'merge-intervals': `def merge_intervals(intervals):
    if not intervals: return []
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for s, e in intervals[1:]:
        if s <= merged[-1][1]: merged[-1][1] = max(merged[-1][1], e)
        else: merged.append([s, e])
    return merged`,

  'rate-limiter': `import time
class TokenBucketRateLimiter:
    def __init__(self, capacity, refill_rate):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_time = time.time()
    def allow(self):
        now = time.time()
        elapsed = now - self.last_time
        self.last_time = now
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False`,

  'kv-store-ttl': `import time
class TTLStore:
    def __init__(self):
        self.store = {}
    def set(self, key, value, ttl=None):
        exp = time.time() + ttl if ttl else None
        self.store[key] = (value, exp)
    def get(self, key):
        if key not in self.store: return None
        value, exp = self.store[key]
        if exp and time.time() > exp:
            del self.store[key]
            return None
        return value
    def delete(self, key):
        self.store.pop(key, None)
    def cleanup(self):
        now = time.time()
        self.store = {k: v for k, v in self.store.items() if v[1] is None or v[1] > now}`,

  'linked-list': `class Node:
    def __init__(self, value):
        self.value = value
        self.prev = None
        self.next = None
class DoublyLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
    def append(self, value):
        node = Node(value)
        if not self.tail:
            self.head = self.tail = node
        else:
            node.prev = self.tail
            self.tail.next = node
            self.tail = node
    def prepend(self, value):
        node = Node(value)
        if not self.head:
            self.head = self.tail = node
        else:
            node.next = self.head
            self.head.prev = node
            self.head = node
    def delete(self, value):
        curr = self.head
        while curr:
            if curr.value == value:
                if curr.prev: curr.prev.next = curr.next
                else: self.head = curr.next
                if curr.next: curr.next.prev = curr.prev
                else: self.tail = curr.prev
                return
            curr = curr.next
    def find(self, value):
        curr = self.head
        while curr:
            if curr.value == value: return True
            curr = curr.next
        return False
    def __iter__(self):
        curr = self.head
        while curr:
            yield curr.value
            curr = curr.next`,

  'priority-queue': `class MinHeap:
    def __init__(self):
        self._data = []
    @property
    def size(self):
        return len(self._data)
    def push(self, value):
        self._data.append(value)
        self._sift_up(len(self._data) - 1)
    def pop(self):
        if not self._data: raise IndexError("empty heap")
        self._data[0], self._data[-1] = self._data[-1], self._data[0]
        val = self._data.pop()
        if self._data: self._sift_down(0)
        return val
    def peek(self):
        if not self._data: raise IndexError("empty heap")
        return self._data[0]
    def _sift_up(self, i):
        while i > 0:
            parent = (i - 1) // 2
            if self._data[i] < self._data[parent]:
                self._data[i], self._data[parent] = self._data[parent], self._data[i]
                i = parent
            else: break
    def _sift_down(self, i):
        n = len(self._data)
        while True:
            smallest = i
            left_child = 2*i+1
            right_child = 2*i+2
            if left_child < n and self._data[left_child] < self._data[smallest]: smallest = left_child
            if right_child < n and self._data[right_child] < self._data[smallest]: smallest = right_child
            if smallest != i:
                self._data[i], self._data[smallest] = self._data[smallest], self._data[i]
                i = smallest
            else: break`,

  'trie': `class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False
class Trie:
    def __init__(self):
        self.root = TrieNode()
    def insert(self, word):
        node = self.root
        for c in word:
            if c not in node.children: node.children[c] = TrieNode()
            node = node.children[c]
        node.is_end = True
    def search(self, word):
        node = self._find(word)
        return node is not None and node.is_end
    def starts_with(self, prefix):
        return self._find(prefix) is not None
    def autocomplete(self, prefix):
        node = self._find(prefix)
        if not node: return []
        results = []
        self._dfs(node, prefix, results)
        return results
    def _find(self, prefix):
        node = self.root
        for c in prefix:
            if c not in node.children: return None
            node = node.children[c]
        return node
    def _dfs(self, node, prefix, results):
        if node.is_end: results.append(prefix)
        for c, child in node.children.items():
            self._dfs(child, prefix + c, results)`,

  'graph-bfs': `from collections import deque
def shortest_path(graph, start, end):
    if start == end: return [start]
    visited = {start}
    queue = deque([(start, [start])])
    while queue:
        node, path = queue.popleft()
        for neighbor in graph.get(node, []):
            if neighbor == end: return path + [neighbor]
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append((neighbor, path + [neighbor]))
    return []`,

  'rest-crud': `from datetime import datetime
class InMemoryCRUD:
    def __init__(self):
        self.items = {}
        self.next_id = 1
    def create(self, name):
        item = {'id': self.next_id, 'name': name, 'created_at': datetime.now().isoformat()}
        self.items[self.next_id] = item
        self.next_id += 1
        return item
    def get(self, id):
        return self.items.get(id)
    def list_all(self):
        return list(self.items.values())
    def update(self, id, name):
        if id not in self.items: return None
        self.items[id]['name'] = name
        return self.items[id]
    def delete(self, id):
        if id not in self.items: return False
        del self.items[id]
        return True`,

  'url-shortener': `import hashlib
class URLShortener:
    def __init__(self):
        self.url_to_code = {}
        self.code_to_url = {}
        self.stats_data = {}
    def shorten(self, url):
        if url in self.url_to_code: return self.url_to_code[url]
        code = hashlib.md5(url.encode()).hexdigest()[:6]
        self.url_to_code[url] = code
        self.code_to_url[code] = url
        self.stats_data[code] = {'clicks': 0}
        return code
    def resolve(self, code):
        if code not in self.code_to_url: return None
        self.stats_data[code]['clicks'] += 1
        return self.code_to_url[code]
    def stats(self, code):
        return self.stats_data.get(code, {'clicks': 0})`,

  'csv-parser': `def parse_csv(text):
    rows = []
    row = []
    field = ''
    in_quotes = False
    i = 0
    while i < len(text):
        c = text[i]
        if in_quotes:
            if c == '"':
                if i + 1 < len(text) and text[i+1] == '"':
                    field += '"'
                    i += 1
                else:
                    in_quotes = False
            else:
                field += c
        else:
            if c == '"':
                in_quotes = True
            elif c == ',':
                row.append(field)
                field = ''
            elif c == '\\n':
                row.append(field)
                rows.append(row)
                row = []
                field = ''
            else:
                field += c
        i += 1
    row.append(field)
    rows.append(row)
    return rows`,

  'json-flatten': `def flatten_json(obj, separator='.', prefix=''):
    result = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            new_key = f"{prefix}{separator}{key}" if prefix else key
            if isinstance(value, (dict, list)):
                result.update(flatten_json(value, separator, new_key))
            else:
                result[new_key] = value
    elif isinstance(obj, list):
        for i, value in enumerate(obj):
            new_key = f"{prefix}{separator}{i}" if prefix else str(i)
            if isinstance(value, (dict, list)):
                result.update(flatten_json(value, separator, new_key))
            else:
                result[new_key] = value
    return result`,

  'markdown-toc': `import re
def generate_toc(markdown_text):
    lines = markdown_text.split('\\n')
    toc = []
    for line in lines:
        m = re.match(r'^(#+)\\s+(.+)$', line)
        if m:
            level = len(m.group(1))
            title = m.group(2)
            anchor = re.sub(r'[^a-z0-9\\s-]', '', title.lower()).strip().replace(' ', '-')
            indent = '  ' * (level - 1)
            toc.append(f"{indent}- [{title}](#{anchor})")
    return '\\n'.join(toc)`,

  'log-analyzer': `from collections import Counter
def analyze_logs(log_text):
    if not log_text.strip():
        return {'total': 0, 'by_level': {}, 'top_errors': []}
    lines = [l for l in log_text.strip().split('\\n') if l.strip()]
    by_level = Counter()
    error_msgs = Counter()
    for line in lines:
        parts = line.split(' ', 2)
        if len(parts) >= 2:
            level = parts[1]
            by_level[level] += 1
            if level == 'ERROR' and len(parts) > 2:
                error_msgs[parts[2]] += 1
    top_errors = [msg for msg, _ in error_msgs.most_common(3)]
    return {'total': len(lines), 'by_level': dict(by_level), 'top_errors': top_errors}`,

  'file-dedup': `import hashlib
def find_duplicates(file_dict):
    hash_to_files = {}
    for path, content in sorted(file_dict.items()):
        h = hashlib.md5(content.encode()).hexdigest()
        if h not in hash_to_files: hash_to_files[h] = []
        hash_to_files[h].append(path)
    return sorted([group for group in hash_to_files.values() if len(group) >= 2])`,

  'auth-jwt': `import hmac, hashlib, base64, json, time
class JWTAuth:
    def encode(self, payload, secret):
        header = base64.urlsafe_b64encode(json.dumps({"alg":"HS256","typ":"JWT"}).encode()).decode().rstrip('=')
        pay = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
        sig = hmac.new(secret.encode(), f"{header}.{pay}".encode(), hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(sig).decode().rstrip('=')
        return f"{header}.{pay}.{sig_b64}"
    def decode(self, token, secret):
        parts = token.split('.')
        sig_check = hmac.new(secret.encode(), f"{parts[0]}.{parts[1]}".encode(), hashlib.sha256).digest()
        sig_b64 = base64.urlsafe_b64encode(sig_check).decode().rstrip('=')
        if sig_b64 != parts[2]: raise Exception("Invalid signature")
        pad = 4 - len(parts[1]) % 4
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=' * pad))
        if 'exp' in payload and payload['exp'] < time.time(): raise Exception("Token expired")
        return payload`,

  'webhook-handler': `import hmac, hashlib
class WebhookHandler:
    def __init__(self):
        self.handlers = {}
    def sign(self, payload_string, secret):
        return hmac.new(secret.encode(), payload_string.encode(), hashlib.sha256).hexdigest()
    def verify(self, payload_string, signature, secret):
        expected = self.sign(payload_string, secret)
        return hmac.compare_digest(expected, signature)
    def register(self, event_type, callback):
        if event_type not in self.handlers: self.handlers[event_type] = []
        self.handlers[event_type].append(callback)
    def dispatch(self, event_type, payload):
        for cb in self.handlers.get(event_type, []):
            cb(payload)`,

  'sse-counter': `class SSEFormatter:
    def format_event(self, data, event=None, id=None):
        lines = []
        if id is not None: lines.append(f"id: {id}")
        if event is not None: lines.append(f"event: {event}")
        lines.append(f"data: {data}")
        return '\\n'.join(lines) + '\\n\\n'
class Counter:
    def __init__(self):
        self._value = 0
        self._formatter = SSEFormatter()
    def increment(self): self._value += 1
    def decrement(self): self._value -= 1
    def get_value(self): return self._value
    def to_sse_event(self):
        return self._formatter.format_event(str(self._value), event='counter')`
};

// Known-bad solutions (should fail at least 1 test)
const badSolutions = {
  'fizzbuzz': 'def fizzbuzz(n): return [str(i) for i in range(1, n+1)]', // Missing Fizz/Buzz
  'binary-search': 'def binary_search(arr, target): return -1', // Always returns -1
  'kv-store-ttl': `class TTLStore:
    def __init__(self): self.store = {}
    def set(self, key, value, ttl=None): self.store[key] = value
    def get(self, key): return self.store.get(key)
    def delete(self, key): pass`, // delete doesn't work
};

describe('challenge loading integration', () => {
  test('all 20 built-in challenges load and validate', () => {
    const challenges = getAllChallenges('builtin');
    expect(challenges.length).toBe(20);
    for (const c of challenges) {
      expect(c.id).toBeTruthy();
      expect(c.tests.length).toBeGreaterThan(0);
    }
  });

  test('known-good solutions pass all tests for each challenge', async () => {
    const challenges = getAllChallenges();
    for (const challenge of challenges) {
      const solution = solutions[challenge.id];
      if (!solution) continue; // skip if no solution provided
      const result = await runTests(challenge, solution);
      if (result.tests_passed !== result.tests_total) {
        const failed = (result.details || []).filter(d => !d.passed).map(d => `${d.name}: ${d.error}`);
        throw new Error(`Challenge "${challenge.id}" failed ${result.tests_total - result.tests_passed}/${result.tests_total} tests:\n${failed.join('\n')}`);
      }
    }
  }, 120000);

  test('known-bad solutions fail at least 1 test', async () => {
    for (const [id, code] of Object.entries(badSolutions)) {
      const challenges = getAllChallenges();
      const challenge = challenges.find(c => c.id === id);
      if (!challenge) continue;
      const result = await runTests(challenge, code);
      expect(result.tests_passed).toBeLessThan(result.tests_total);
    }
  }, 60000);
});
