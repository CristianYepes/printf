/* ************************************************************************** */
/*                                                                            */
/*                                                        :::      ::::::::   */
/*   ft_print_char.c                                    :+:      :+:    :+:   */
/*                                                    +:+ +:+         +:+     */
/*   By: cristian <cristian@student.42.fr>          +#+  +:+       +#+        */
/*                                                +#+#+#+#+#+   +#+           */
/*   Created: 2026/05/11 01:08:05 by cristian          #+#    #+#             */
/*   Updated: 2026/05/11 01:08:07 by cristian         ###   ########.fr       */
/*                                                                            */
/* ************************************************************************** */

#include "ft_printf.h"

int	ft_print_c(char c)
{
	write(1, &c, 1);
	return (1);
}

int	ft_print_char(char c, t_flags *flags)
{
	int	count;

	count = 0;
	if (flags->left == 1)
		count += ft_print_c(c);
	count += ft_pad_width(flags->width, 1, flags->zero);
	if (flags->left == 0)
		count += ft_print_c(c);
	return (count);
}
