 Onde Estacionei? PAM II – Projeto 4

App em React Native (Expo) que registra a vaga do veículo, guia o retorno a pé e
controla o tempo do parquímetro / Zona Azul.

## Requisitos da especificação → onde estão no código

| Conceito | Requisito | Implementação |
|---|---|---|
| Localização e Mapas | Gravar coordenada com um toque | `HomeScreen.js` → `handleSave` |
| Localização e Mapas | Rota a pé até o veículo | `services/routing.js` + `<Polyline>` |
| Notificações | Aviso 10 min antes do vencimento | `services/notifications.js` → `scheduleParkingAlerts` |
| Widgets | Tempo restante + distância na home | `widget/ParkingWidget.js` |
| Sensores | Barômetro → altitude (ou formulário manual) | `hooks/useBarometer.js` + campo de observação |
| Simplificação | Persistir no AsyncStorage | `services/storage.js` |

## Como rodar

O widget usa código nativo, então o app **não roda no Expo Go**: deve usar um *development build*.

```bash
# 1. Criar o projeto base
npx create-expo-app@latest onde-estacionei --template blank
cd onde-estacionei

# 2. Instalar dependências
npx expo install react-native-maps expo-location expo-notifications expo-sensors \
  @react-native-async-storage/async-storage expo-dev-client
npm install react-native-android-widget

# 3. Copie por cima: app.json, index.js, App.js e a pasta src/
#    Confirme que o package.json tem  "main": "index.js"

# 4. Coloque sua chave do Google Maps em app.json
#    (android.config.googleMaps.apiKey)

# 5. Gerar e rodar no Android (celular ou emulador)
npx expo prebuild --clean
npx expo run:android
```

Depois de instalado, segure na tela inicial do Android → **Widgets** → **Onde Estacionei?**.

> No iOS o app funciona (mapas, rota, notificações, barômetro), mas o widget é só Android.

## Como testar

1. Abra o app e aceite as permissões de localização e notificações.
2. Digite **11** em "Outro tempo (em minutos)" e toque em **Salvar vaga aqui**.
   O aviso de 10 minutos chega em ~1 minuto, o de esgotado em 11 minutos.
3. Caminhe alguns metros e veja a distância e a rota se atualizarem.
4. Feche o app completamente e abra de novo: a vaga continua salva.
5. Adicione o widget e confira o tempo e a distância.

## Detalhes e limitações

- **Rota a pé:** usa o roteador público do OpenStreetMap, sem chave. Sem internet, o app
  desenha uma linha reta até o veículo.
- **Barômetro:** nem todo aparelho tem. A altitude é estimada pela pressão e varia com o
  clima do dia; por isso existe o campo manual (ex.: "2º subsolo").
- **Widget:** o Android não permite atualização a cada segundo, então ele mostra o tempo em
  minutos e o horário de vencimento. É redesenhado quando o app salva a vaga, a cada ~30 s
  ou 20 m de deslocamento com o app aberto, e a cada 30 min pelo sistema. A distância
  exibida é a última medida pelo app.
- **Notificações exatas:** no Android 12+ o alarme exato pode exigir a permissão
  "Alarmes e lembretes" do aparelho; sem ela, o aviso pode atrasar alguns minutos.
- Se faltarem menos de 10 min no momento de salvar, só o aviso final é agendado.

## Estrutura

```
├── app.json
├── index.js
├── App.js
└── src
    ├── hooks        useBarometer.js · useCountdown.js
    ├── screens      HomeScreen.js
    ├── services     storage.js · notifications.js · routing.js
    ├── utils        geo.js (Haversine, formatação, pressão → altitude)
    └── widget       ParkingWidget.js · widgetTaskHandler.js · updateWidget.js
```
