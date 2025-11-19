import requests
url = 'https://ip.decodo.com/json'
proxy = f"http://ng.decodo.com:42001"
result = requests.get(url, proxies = {
    'http': proxy,
    'https': proxy
})
print(result.text)