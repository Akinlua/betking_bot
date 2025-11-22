import urllib.request
import ssl

proxy = 'http://brd-customer-hl_3fa1037b-zone-datacenter_proxy2:vf9yvwp1cl95@brd.superproxy.io:33335'
url = 'https://ip.decodo.com/json'

opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({'https': proxy, 'http': proxy})
)

try:
    print(opener.open(url).read().decode())
except Exception as e:
    print(f"Error: {e}")
