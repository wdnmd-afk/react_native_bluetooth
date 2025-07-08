import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  StatusBar,
  useColorScheme,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import BluetoothClassic, { BluetoothDevice as BTDevice } from 'react-native-bluetooth-classic';

interface BluetoothDevice {
  id: string;
  name: string;
  address: string;
  type: 'SPP' | 'BLE';
  connected: boolean;
}

// 图标组件
const BluetoothIcon = ({ size = 24, color = '#007AFF' }: { size?: number; color?: string }) => (
  <View style={[styles.icon, { width: size, height: size }]}>
    <Text style={[styles.iconText, { color, fontSize: size * 0.6 }]}>📶</Text>
  </View>
);

const SearchIcon = ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color }}>🔍</Text>
);

const ConnectedIcon = ({ size = 16, color = '#4CAF50' }: { size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color }}>✅</Text>
);

const DisconnectIcon = ({ size = 14, color = '#fff' }: { size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color }}>❌</Text>
);

const SPPIcon = ({ size = 14, color = '#007AFF' }: { size?: number; color?: string }) => (
  <Text style={{ fontSize: size, color }}>⚡</Text>
);

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [bluetoothEnabled, setBluetoothEnabled] = useState(false);

  useEffect(() => {
    checkBluetoothStatus();
    requestPermissions();
  }, []);

  // 检查蓝牙状态
  const checkBluetoothStatus = async (): Promise<void> => {
    try {
      const enabled = await BluetoothClassic.isBluetoothEnabled();
      setBluetoothEnabled(enabled);
    } catch (error) {
      console.log('检查蓝牙状态失败:', error);
    }
  };

  // 请求权限
  const requestPermissions = async (): Promise<void> => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (allGranted) {
          console.log('所有权限已获取');
        } else {
          Alert.alert('权限不足', '请在设置中手动开启蓝牙和定位权限');
        }
      } catch (error) {
        console.log('请求权限失败:', error);
      }
    }
  };

  // 扫描蓝牙设备
  const scanForDevices = async (): Promise<void> => {
    if (!bluetoothEnabled) {
      Alert.alert('蓝牙未开启', '请先开启蓝牙功能');
      return;
    }

    setScanning(true);
    setDevices([]);

    try {
      // 获取已配对的设备
      const pairedDevices: BTDevice[] = await BluetoothClassic.getBondedDevices();
      
      // 开始发现新设备
      await BluetoothClassic.startDiscovery();
      
      // 处理已配对设备
      const formattedPairedDevices: BluetoothDevice[] = pairedDevices.map((device: BTDevice) => ({
        id: device.address,
        name: device.name || '未知设备',
        address: device.address,
        type: 'SPP' as const,
        connected: false,
      }));

      // SPP设备排在前面
      const sortedDevices = formattedPairedDevices.sort((a, b) => {
        if (a.type === 'SPP' && b.type === 'BLE') return -1;
        if (a.type === 'BLE' && b.type === 'SPP') return 1;
        return 0;
      });

      setDevices(sortedDevices);

      // 监听发现的新设备
      const deviceFoundListener = BluetoothClassic.onDeviceDiscovered((device: BTDevice) => {
        const newDevice: BluetoothDevice = {
          id: device.address,
          name: device.name || '未知设备',
          address: device.address,
          type: 'SPP' as const,
          connected: false,
        };

        setDevices(prevDevices => {
          const exists = prevDevices.find(d => d.address === device.address);
          if (!exists) {
            const updatedDevices = [...prevDevices, newDevice];
            return updatedDevices.sort((a, b) => {
              if (a.type === 'SPP' && b.type === 'BLE') return -1;
              if (a.type === 'BLE' && b.type === 'SPP') return 1;
              return 0;
            });
          }
          return prevDevices;
        });
      });

      // 10秒后停止扫描
      setTimeout(async () => {
        try {
          await BluetoothClassic.cancelDiscovery();
          setScanning(false);
          deviceFoundListener.remove();
        } catch (error) {
          console.log('停止扫描失败:', error);
          setScanning(false);
        }
      }, 10000);

    } catch (error) {
      console.log('扫描设备失败:', error);
      setScanning(false);
      Alert.alert('扫描失败', '无法扫描蓝牙设备，请检查权限设置');
    }
  };

  // 连接设备
  const connectToDevice = async (device: BluetoothDevice): Promise<void> => {
    setConnecting(device.address);
    
    try {
      const connected = await BluetoothClassic.connectToDevice(device.address);
      
      if (connected) {
        setConnectedDevice(device);
        setDevices(prevDevices => 
          prevDevices.map(d => 
            d.address === device.address 
              ? { ...d, connected: true }
              : { ...d, connected: false }
          )
        );
        Alert.alert('连接成功', `已连接到 ${device.name}`);
      } else {
        Alert.alert('连接失败', '无法连接到该设备');
      }
    } catch (error) {
      console.log('连接设备失败:', error);
      Alert.alert('连接失败', '连接设备时发生错误');
    } finally {
      setConnecting(null);
    }
  };

  // 断开连接
  const disconnectDevice = async (): Promise<void> => {
    if (connectedDevice) {
      try {
        await BluetoothClassic.disconnectFromDevice(connectedDevice.address);
        setConnectedDevice(null);
        setDevices(prevDevices => 
          prevDevices.map(d => ({ ...d, connected: false }))
        );
        Alert.alert('已断开连接', '设备连接已断开');
      } catch (error) {
        console.log('断开连接失败:', error);
      }
    }
  };

  // 渲染设备项
  const renderDeviceItem = ({ item }: { item: BluetoothDevice }): React.JSX.Element => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        item.connected && styles.connectedDevice,
        item.type === 'SPP' && styles.sppDevice,
        isDarkMode && styles.deviceItemDark,
      ]}
      onPress={() => connectToDevice(item)}
      disabled={connecting === item.address}
      activeOpacity={0.7}
    >
      <View style={styles.deviceIcon}>
        <BluetoothIcon size={32} color={item.connected ? '#4CAF50' : '#007AFF'} />
      </View>
      
      <View style={styles.deviceInfo}>
        <View style={styles.deviceNameRow}>
          <Text style={[styles.deviceName, isDarkMode && styles.textDark]}>
            {item.name}
          </Text>
          {item.type === 'SPP' && (
            <View style={styles.sppBadge}>
              <SPPIcon size={12} />
              <Text style={styles.sppBadgeText}>SPP</Text>
            </View>
          )}
        </View>
        <Text style={[styles.deviceAddress, isDarkMode && styles.textSecondaryDark]}>
          {item.address}
        </Text>
      </View>
      
      <View style={styles.deviceStatus}>
        {connecting === item.address ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : item.connected ? (
          <View style={styles.statusContainer}>
            <ConnectedIcon />
            <Text style={styles.connectedText}>已连接</Text>
          </View>
        ) : (
          <View style={styles.connectButton}>
            <Text style={styles.connectText}>连接</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const backgroundColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const cardBackground = isDarkMode ? '#2d2d2d' : '#ffffff';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar 
        barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
        backgroundColor={backgroundColor}
      />
      
      <View style={[styles.header, { backgroundColor: cardBackground }]}>
        <View style={styles.headerContent}>
          <BluetoothIcon size={28} />
          <Text style={[styles.title, isDarkMode && styles.textDark]}>
            蓝牙打印机
          </Text>
        </View>
        
        {connectedDevice && (
          <View style={styles.connectedInfo}>
            <View style={styles.connectedDeviceInfo}>
              <ConnectedIcon size={18} />
              <Text style={[styles.connectedDeviceName, isDarkMode && styles.textDark]}>
                {connectedDevice.name}
              </Text>
            </View>
            <TouchableOpacity onPress={disconnectDevice} style={styles.disconnectButton}>
              <DisconnectIcon size={12} />
              <Text style={styles.disconnectText}>断开</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[
            styles.scanButton,
            scanning && styles.scanningButton,
            !bluetoothEnabled && styles.disabledButton,
          ]}
          onPress={scanForDevices}
          disabled={scanning || !bluetoothEnabled}
          activeOpacity={0.8}
        >
          {scanning ? (
            <ActivityIndicator size="small" color="#fff" style={styles.scanIcon} />
          ) : (
            <SearchIcon size={18} />
          )}
          <Text style={styles.scanButtonText}>
            {scanning ? '扫描中...' : bluetoothEnabled ? '扫描设备' : '蓝牙未开启'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={devices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.address}
        style={styles.deviceList}
        contentContainerStyle={styles.deviceListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <BluetoothIcon size={64} color={isDarkMode ? '#666' : '#ccc'} />
            <Text style={[styles.emptyText, isDarkMode && styles.textSecondaryDark]}>
              {scanning ? '正在扫描设备...' : '点击扫描按钮开始搜索蓝牙设备'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 12,
    color: '#1a1a1a',
  },
  textDark: {
    color: '#ffffff',
  },
  textSecondaryDark: {
    color: '#cccccc',
  },
  connectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3f2fd',
  },
  connectedDeviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  connectedDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976d2',
    marginLeft: 8,
  },
  disconnectButton: {
    backgroundColor: '#ff5252',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  disconnectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  controls: {
    padding: 20,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  scanningButton: {
    backgroundColor: '#666',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  scanIcon: {
    marginRight: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deviceList: {
    flex: 1,
  },
  deviceListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  deviceItemDark: {
    backgroundColor: '#2d2d2d',
  },
  sppDevice: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  connectedDevice: {
    backgroundColor: '#e8f5e8',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  deviceIcon: {
    marginRight: 16,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  deviceAddress: {
    fontSize: 12,
    color: '#666',
  },
  sppBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  sppBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 2,
  },
  deviceStatus: {
    alignItems: 'center',
    minWidth: 60,
  },
  statusContainer: {
    alignItems: 'center',
  },
  connectedText: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 12,
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  connectText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontWeight: 'bold',
  },
});

export default App;
