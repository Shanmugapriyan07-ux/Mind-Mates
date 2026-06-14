import { Stack } from 'expo-router';
export default function AuthLayout() {
  return (
    <Stack
    >
      <Stack.Screen name="onBoarding" options={{
        headerShown: false,
        lazy: false,
        freezeOnBlur: true,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}/>
         <Stack.Screen name="Google" options={{
      headerShown: false,
      lazy: false,
      freezeOnBlur: true, 
      animation:'none',
       contentStyle: { backgroundColor: '#FFFFFF' },
    }}/>
    </Stack>
  );
}
