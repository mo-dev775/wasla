package net.moha.modev.tel.wasla

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class NewUser(val full_name: String, val email: String, val location: String, val address: String)

@Composable
fun RegisterScreen(onRegistered: () -> Unit) {
    var fullName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var address by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(Modifier.padding(24.dp)) {
        OutlinedTextField(fullName, { fullName = it }, label = { Text("Full name") })
        OutlinedTextField(email, { email = it }, label = { Text("Contact email") })
        OutlinedTextField(location, { location = it }, label = { Text("Location") })
        OutlinedTextField(address, { address = it }, label = { Text("Address") })
        OutlinedTextField(password, { password = it }, label = { Text("Password") })
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }

        Spacer(Modifier.height(16.dp))
        Button(onClick = {
            scope.launch {
                try {
                    val authEmail = "$email.register@wasla.internal" // temp placeholder pattern, refine in Stage 3
                    SupabaseClientProvider.client.auth.signUpWith(Email) {
                        this.email = authEmail
                        this.password = password
                    }
                    SupabaseClientProvider.client.postgrest["users"].insert(
                        NewUser(fullName, email, location, address)
                    )
                    onRegistered()
                } catch (e: Exception) {
                    error = e.message
                }
            }
        }) {
            Text("Register")
        }
    }
}